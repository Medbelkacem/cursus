// §11 — Règlement pédagogique configurable.
//
// Aucune règle de validation, de rattrapage ou d'exclusion n'est codée en dur :
// tout provient de cette table. Priorité d'application :
//   établissement › wilaya › national › valeurs neutres par défaut.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Input, Select, Checkbox } from '../../components/input.js';
import { Badge } from '../../components/badge.js';
import { Modal, confirmDialog } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { SectionHead, Notice } from '../../lib/ui.js';
import { FAILURE_DECISIONS } from '../../lib/nomenclature.js';
import { EmptyBlock } from '../../lib/page-helpers.js';
import {
  listAcademicRules, createAcademicRule, updateAcademicRule, deleteAcademicRule,
  listWilayas, listEstablishments, effectiveRule,
} from '../../lib/db.js';

const SCOPE_LABEL = { national: 'National', wilaya: 'Wilaya', establishment: 'Établissement' };

export async function academicRulesPage() {
  return protectedPage({
    role: ['ministry', 'direction', 'admin'],
    title: 'Règlement pédagogique',
    breadcrumb: 'Administration · Règlement pédagogique',
    active: t('nav.rules'),
    build: async ({ profile }) => {
      const role = profile.role;
      const [rules, wilayas, estabs, applied] = await Promise.all([
        listAcademicRules(),
        listWilayas().catch(() => []),
        listEstablishments().catch(() => []),
        effectiveRule(profile.establishment_id || null).catch(() => null),
      ]);

      const reload = () => window.location.reload();

      // Portée que chaque rôle peut créer (miroir des policies RLS)
      const allowedScopes = role === 'ministry' ? ['national', 'wilaya', 'establishment']
        : role === 'direction' ? ['wilaya']
        : ['establishment'];

      function openForm(rule = null) {
        const scope = Select({
          value: rule?.scope || allowedScopes[0],
          options: allowedScopes.map((s) => ({ value: s, label: SCOPE_LABEL[s] })),
          disabled: !!rule,
        });
        const wilayaSel = Select({
          value: rule?.wilaya_id || profile.wilaya_id || '',
          options: [{ value: '', label: '— choisir —' },
            ...wilayas.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }))],
        });
        const estabSel = Select({
          value: rule?.establishment_id || profile.establishment_id || '',
          options: [{ value: '', label: '— choisir —' },
            ...estabs.map((e) => ({ value: e.id, label: e.name }))],
        });
        const label = Input({ value: rule?.label || 'Règlement pédagogique' });
        const pass = Input({ type: 'number', step: '0.25', min: '0', max: '20',
                             value: rule?.pass_mark ?? 10 });
        const resitPass = Input({ type: 'number', step: '0.25', min: '0', max: '20',
                                  value: rule?.resit_pass_mark ?? 10 });
        const minAtt = Input({ type: 'number', step: '1', min: '0', max: '100',
                               value: rule?.min_attendance_rate ?? '' });
        const maxRepeats = Input({ type: 'number', min: '0', value: rule?.max_repeats ?? 1 });
        const onFailure = Select({
          value: rule?.on_resit_failure || 'manual_review',
          options: Object.entries(FAILURE_DECISIONS).map(([v, m]) => ({ value: v, label: m.label })),
        });
        const autoProgress = Checkbox({
          label: 'Passage automatique au semestre suivant après validation',
          checked: rule?.auto_progress ?? true,
        });
        const autoResit = Checkbox({
          label: 'Basculement automatique en « rattrapage » sous le seuil',
          checked: rule?.auto_resit ?? true,
        });
        const active = Checkbox({ label: 'Règlement actif', checked: rule?.active ?? true });

        const wilayaField = Field({ label: 'Wilaya', children: wilayaSel });
        const estabField = Field({ label: 'Établissement', children: estabSel });
        function sync() {
          wilayaField.hidden = scope.value !== 'wilaya';
          estabField.hidden = scope.value !== 'establishment';
        }
        scope.addEventListener('change', sync);
        sync();

        const save = Button({ label: rule ? 'Enregistrer' : 'Créer', icon: rule ? 'save' : 'plus',
                              variant: 'primary' });
        const cancel = Button({ label: 'Annuler', variant: 'secondary' });
        const del = rule ? Button({ label: 'Supprimer', icon: 'trash', variant: 'danger' }) : null;

        const m = Modal({
          title: rule ? `Règlement — ${SCOPE_LABEL[rule.scope]}` : 'Nouveau règlement pédagogique',
          size: 'lg',
          children: [
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Portée', children: scope }),
              Field({ label: 'Intitulé', children: label }),
            ]),
            wilayaField,
            estabField,
            h('div.form-grid', {}, [
              Field({ label: 'Seuil de validation', children: pass, hint: 'sur 20 — ex. 10' }),
              Field({ label: 'Seuil au rattrapage', children: resitPass, hint: 'sur 20' }),
              Field({ label: 'Présence minimale (%)', children: minAtt, hint: 'facultatif' }),
            ]),
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Décision si rattrapage non validé', children: onFailure }),
              Field({ label: 'Redoublements autorisés', children: maxRepeats }),
            ]),
            h('div', { style: { display: 'grid', gap: '6px' } }, [autoProgress, autoResit, active]),
            Notice({ tone: 'info' }, [
              'Ces valeurs pilotent directement le moteur de calcul : dès qu’une note est saisie, '
              + 'la moyenne du semestre est recalculée et le statut mis à jour en conséquence.',
            ]),
          ],
          actions: [del, cancel, save].filter(Boolean),
        });

        cancel.addEventListener('click', () => m.close());
        save.addEventListener('click', async () => {
          const payload = {
            scope: scope.value,
            wilaya_id: scope.value === 'wilaya' ? (wilayaSel.value || null) : null,
            establishment_id: scope.value === 'establishment' ? (estabSel.value || null) : null,
            label: label.value.trim() || 'Règlement pédagogique',
            pass_mark: Number(pass.value),
            resit_pass_mark: Number(resitPass.value),
            min_attendance_rate: minAtt.value === '' ? null : Number(minAtt.value),
            max_repeats: Number(maxRepeats.value) || 0,
            on_resit_failure: onFailure.value,
            auto_progress: autoProgress.querySelector('input').checked,
            auto_resit: autoResit.querySelector('input').checked,
            active: active.querySelector('input').checked,
          };
          if (payload.scope === 'wilaya' && !payload.wilaya_id) {
            toast('Choisissez une wilaya.', { tone: 'warn' }); return;
          }
          if (payload.scope === 'establishment' && !payload.establishment_id) {
            toast('Choisissez un établissement.', { tone: 'warn' }); return;
          }
          save.disabled = true;
          try {
            if (rule) await updateAcademicRule(rule.id, payload);
            else await createAcademicRule(payload);
            toast('Règlement enregistré.', { tone: 'success' });
            m.close(); reload();
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Enregistrement impossible. Un règlement actif existe peut-être déjà '
              + 'pour cette portée.', { tone: 'danger' });
          }
        });
        del?.addEventListener('click', async () => {
          const ok = await confirmDialog({
            title: 'Supprimer le règlement',
            message: 'Le règlement de portée supérieure s’appliquera à nouveau.',
            confirmLabel: 'Supprimer', danger: true,
          });
          if (!ok) return;
          await deleteAcademicRule(rule.id);
          toast('Règlement supprimé.', { tone: 'success' });
          m.close(); reload();
        });
        m.open();
      }

      const rulesCards = rules.map((r) => Card({ padding: 18 }, [
        h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '12px',
                            alignItems: 'flex-start', marginBottom: '10px' } }, [
          h('div', {}, [
            h('h3.card__title', {}, [r.label]),
            h('div.small.mute', {}, [
              SCOPE_LABEL[r.scope],
              r.wilayas ? ` · ${r.wilayas.code} — ${r.wilayas.name}` : '',
              r.establishments ? ` · ${r.establishments.name}` : '',
            ].join('')),
          ]),
          r.active
            ? Badge({ tone: 'success', size: 'sm', dot: true }, ['actif'])
            : Badge({ tone: 'neutral', size: 'sm', dot: true }, ['inactif']),
        ]),
        h('dl', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                           gap: '10px 16px', margin: 0 } }, [
          ['Seuil de validation', `${Number(r.pass_mark).toFixed(2)}/20`],
          ['Seuil au rattrapage', `${Number(r.resit_pass_mark).toFixed(2)}/20`],
          ['Si rattrapage échoué', FAILURE_DECISIONS[r.on_resit_failure]?.label],
          ['Redoublements', String(r.max_repeats)],
          ['Présence minimale', r.min_attendance_rate != null ? `${r.min_attendance_rate} %` : '—'],
          ['Progression auto.', r.auto_progress ? 'Oui' : 'Non'],
          ['Rattrapage auto.', r.auto_resit ? 'Oui' : 'Non'],
        ].map(([k, v]) => h('div', {}, [
          h('dt.kpi__label', {}, [k]),
          h('dd', { style: { margin: '2px 0 0', fontSize: '13px', fontWeight: 600 } }, [v]),
        ]))),
        h('div', { style: { marginTop: '14px' } }, [
          Button({ label: 'Modifier', icon: 'edit', variant: 'ghost', size: 'sm',
                   onClick: () => openForm(r) }),
        ]),
      ]));

      return [
        SectionHead(
          'Règlement pédagogique',
          'Seuils de validation, rattrapage et décision applicable — configurables, jamais codés en dur',
          Button({ label: 'Nouveau règlement', icon: 'plus', variant: 'primary',
                   onClick: () => openForm() })
        ),

        applied && Card({ padding: 18, accent: true }, [
          h('div.kpi__label', {}, ['Règlement actuellement appliqué à votre périmètre']),
          h('div', { style: { fontSize: '15px', fontWeight: 600, margin: '4px 0 8px' } }, [
            applied.label,
            h('span.mono.small.mute', { style: { marginInlineStart: '8px' } }, [`(${applied.source})`]),
          ]),
          h('div.small', {}, [
            `Validation à ${Number(applied.pass_mark).toFixed(2)}/20 · `
            + `rattrapage à ${Number(applied.resit_pass_mark).toFixed(2)}/20 · `
            + `en cas d'échec : ${FAILURE_DECISIONS[applied.on_resit_failure]?.label}`,
          ]),
        ]),

        rules.length === 0
          ? Notice({ tone: 'info', title: 'Aucun règlement enregistré' }, [
              'Tant qu’aucun règlement n’est défini, la plateforme applique des valeurs neutres : '
              + 'validation à 10/20, rattrapage à 10/20, et aucune exclusion automatique — la décision '
              + 'reste manuelle.',
            ])
          : h('div', { style: { display: 'grid', gap: 'var(--s-3)',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' } },
              rulesCards),
      ].filter(Boolean);
    },
  });
}
