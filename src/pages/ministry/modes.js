// §8 — Modes de formation.
// La table démarre vide (§1). Le ministère saisit les modes un à un, ou
// déclenche explicitement l'import du référentiel officiel des 5 modes.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Input, Textarea, Select, Checkbox } from '../../components/input.js';
import { Badge } from '../../components/badge.js';
import { Modal, confirmDialog } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { StatusPill, SectionHead, Notice } from '../../lib/ui.js';
import { ENTITY_STATUS, TRAINING_MODE_PRESETS } from '../../lib/nomenclature.js';
import {
  listTrainingModes, upsertTrainingMode, updateTrainingMode, deleteTrainingMode,
} from '../../lib/db.js';

function ageLabel(m) {
  if (m.min_age == null && m.max_age == null && m.max_age_female == null) return '—';
  const base = `${m.min_age ?? '?'}–${m.max_age ?? '?'} ans`;
  return m.max_age_female ? `${base} · femmes jusqu'à ${m.max_age_female} ans` : base;
}

export async function ministryModesPage() {
  return protectedPage({
    role: 'ministry',
    title: 'Modes de formation',
    breadcrumb: 'Ministère · Modes de formation',
    active: t('nav.modes'),
    build: async () => {
      const modes = await listTrainingModes();
      const existing = new Set(modes.map((m) => m.code));
      const missing = TRAINING_MODE_PRESETS.filter((p) => !existing.has(p.code));
      const reload = () => window.location.reload();

      function openForm(mode = null) {
        const code = Input({ value: mode?.code || '', placeholder: 'residential' });
        const name = Input({ value: mode?.name || '', placeholder: 'Formation résidentielle' });
        const nameAr = Input({ value: mode?.name_ar || '', dir: 'rtl' });
        const desc = Textarea({ rows: 3, value: mode?.description || '' });
        const audience = Textarea({ rows: 2, value: mode?.target_audience || '' });
        const minAge = Input({ type: 'number', min: '0', max: '99', value: mode?.min_age ?? '' });
        const maxAge = Input({ type: 'number', min: '0', max: '99', value: mode?.max_age ?? '' });
        const maxAgeF = Input({ type: 'number', min: '0', max: '99', value: mode?.max_age_female ?? '' });
        const contract = Checkbox({
          label: "Contrat obligatoire (apprentissage)",
          checked: mode?.requires_contract ?? false,
        });
        const status = Select({
          value: mode?.status || 'active',
          options: Object.entries(ENTITY_STATUS).map(([v, mm]) => ({ value: v, label: mm.label })),
        });
        const position = Input({ type: 'number', min: '0', value: mode?.position ?? modes.length + 1 });

        const save = Button({ label: mode ? 'Enregistrer' : 'Créer le mode', icon: mode ? 'save' : 'plus', variant: 'primary' });
        const cancel = Button({ label: 'Annuler', variant: 'secondary' });
        const del = mode
          ? Button({ label: 'Supprimer', icon: 'trash', variant: 'danger' })
          : null;

        const m = Modal({
          title: mode ? mode.name : 'Nouveau mode de formation',
          size: 'lg',
          children: [
            h('div.form-grid', {}, [
              Field({ label: 'Code', required: true, children: code, hint: 'Identifiant technique unique' }),
              Field({ label: 'Statut', children: status }),
              Field({ label: 'Ordre d’affichage', children: position }),
            ]),
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Nom', required: true, children: name }),
              Field({ label: 'Nom en arabe', children: nameAr }),
            ]),
            Field({ label: 'Description', children: desc }),
            Field({ label: 'Public visé', children: audience }),
            h('div.form-grid', {}, [
              Field({ label: 'Âge minimum', children: minAge }),
              Field({ label: 'Âge maximum', children: maxAge }),
              Field({ label: 'Âge max. (femmes)', children: maxAgeF }),
            ]),
            contract,
          ],
          actions: [del, cancel, save].filter(Boolean),
        });

        cancel.addEventListener('click', () => m.close());

        save.addEventListener('click', async () => {
          if (!code.value.trim() || !name.value.trim()) {
            toast('Code et nom sont requis.', { tone: 'warn' }); return;
          }
          const payload = {
            code: code.value.trim(),
            name: name.value.trim(),
            name_ar: nameAr.value.trim() || null,
            description: desc.value.trim() || null,
            target_audience: audience.value.trim() || null,
            min_age: minAge.value === '' ? null : Number(minAge.value),
            max_age: maxAge.value === '' ? null : Number(maxAge.value),
            max_age_female: maxAgeF.value === '' ? null : Number(maxAgeF.value),
            requires_contract: contract.querySelector('input').checked,
            status: status.value,
            position: Number(position.value) || 0,
          };
          save.disabled = true;
          try {
            if (mode) await updateTrainingMode(mode.id, payload);
            else await upsertTrainingMode(payload);
            toast(mode ? 'Mode mis à jour.' : 'Mode créé.', { tone: 'success' });
            m.close();
            reload();
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Enregistrement impossible.', { tone: 'danger' });
          }
        });

        del?.addEventListener('click', async () => {
          const ok = await confirmDialog({
            title: 'Supprimer le mode',
            message: `« ${mode.name} » sera supprimé. Les programmes et étudiants qui l'utilisent `
              + 'perdront cette référence.',
            confirmLabel: 'Supprimer', danger: true,
          });
          if (!ok) return;
          try {
            await deleteTrainingMode(mode.id);
            toast('Mode supprimé.', { tone: 'success' });
            m.close();
            reload();
          } catch (err) {
            toast(err.message || 'Suppression impossible.', { tone: 'danger' });
          }
        });

        m.open();
      }

      async function importOfficial() {
        const ok = await confirmDialog({
          title: 'Importer le référentiel officiel',
          message: `${missing.length} mode(s) de formation officiels seront ajoutés : `
            + missing.map((p) => p.name).join(', ') + '. Les modes déjà présents ne sont pas modifiés.',
          confirmLabel: 'Importer',
        });
        if (!ok) return;
        try {
          await upsertTrainingMode(missing.map((p) => ({ ...p, status: 'active' })));
          toast(`${missing.length} mode(s) importé(s).`, { tone: 'success' });
          reload();
        } catch (err) {
          toast(err.message || 'Import impossible.', { tone: 'danger' });
        }
      }

      const cards = modes.map((mo) => Card({ padding: 18 }, [
        h('div', {
          style: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' },
        }, [
          h('div', {}, [
            h('h3.card__title', {}, [mo.name]),
            mo.name_ar && h('div.small.mute', { dir: 'rtl' }, [mo.name_ar]),
            h('div.mono.small.mute', { style: { marginTop: 2 } }, [mo.code]),
          ].filter(Boolean)),
          h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, [
            StatusPill(ENTITY_STATUS, mo.status),
            mo.requires_contract && Badge({ tone: 'accent', size: 'sm' }, ['contrat requis']),
          ].filter(Boolean)),
        ]),

        mo.description && h('p', {
          style: { fontSize: '13px', lineHeight: 1.6, marginTop: '10px', color: 'var(--c-ink-2)' },
        }, [mo.description]),

        h('dl', {
          style: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px',
                   fontSize: '12.5px', margin: '12px 0 0' },
        }, [
          h('dt.mute', {}, ['Public visé']),
          h('dd', { style: { margin: 0 } }, [mo.target_audience || '—']),
          h('dt.mute', {}, ['Âge']),
          h('dd', { style: { margin: 0 } }, [ageLabel(mo)]),
        ]),

        h('div', { style: { marginTop: '14px' } }, [
          Button({ label: 'Modifier', icon: 'edit', variant: 'ghost', size: 'sm',
                   onClick: () => openForm(mo) }),
        ]),
      ]));

      return [
        SectionHead(
          'Modes de formation',
          `${modes.length} mode${modes.length > 1 ? 's' : ''} enregistré${modes.length > 1 ? 's' : ''}`,
          [
            missing.length > 0 && Button({
              label: `Importer les ${missing.length} modes officiels`,
              icon: 'download', variant: 'secondary', onClick: importOfficial,
            }),
            Button({ label: 'Nouveau mode', icon: 'plus', variant: 'primary', onClick: () => openForm() }),
          ].filter(Boolean)
        ),

        modes.length === 0
          ? Notice({ tone: 'info', title: 'Aucun mode enregistré' }, [
              'La plateforme démarre sans donnée. Utilisez « Importer les modes officiels » pour '
              + 'ajouter les cinq modes réglementaires (résidentielle, apprentissage, à distance, '
              + 'cours du soir, unités mobiles), ou créez vos propres modes.',
            ])
          : null,

        modes.length > 0 && h('div', {
          style: { display: 'grid', gap: 'var(--s-3)',
                   gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' },
        }, cards),
      ].filter(Boolean);
    },
  });
}
