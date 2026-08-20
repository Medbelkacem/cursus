// §20 — Centre de notifications, commun à tous les rôles.
// Le personnel autorisé peut également diffuser une annonce administrative.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Input, Select, Textarea } from '../../components/input.js';
import { Icon } from '../../components/icon.js';
import { Modal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { SectionHead, Notice } from '../../lib/ui.js';
import { ROLES } from '../../lib/nomenclature.js';
import { EmptyBlock, fmtDateTime } from '../../lib/page-helpers.js';
import { navigate } from '../../lib/router.js';
import {
  listNotifications, markNotificationsRead, broadcastAnnouncement,
  listWilayas, listEstablishments,
} from '../../lib/db.js';

const KIND_ICON = {
  account_created: 'user-plus',
  account_status: 'user',
  contract_submitted: 'briefcase',
  contract_approved: 'check-circle',
  contract_rejected: 'alert',
  contract_modification: 'edit',
  internship_deadline: 'clock',
  program_published: 'book',
  course_published: 'file-text',
  exam_result: 'award',
  resit_exam: 'alert',
  semester_validated: 'check-circle',
  announcement: 'send',
};

export async function notificationsPage() {
  return protectedPage({
    title: 'Notifications',
    breadcrumb: 'Notifications',
    active: t('nav.notifications'),
    build: async ({ profile }) => {
      const items = await listNotifications(100);
      const unread = items.filter((n) => !n.read_at);
      const canBroadcast = ['ministry', 'direction', 'admin'].includes(profile.role);

      const reload = () => window.location.reload();

      // ── Diffusion d'une annonce ────────────────────────────────────────
      async function openBroadcast() {
        const [wilayas, estabs] = await Promise.all([
          listWilayas().catch(() => []),
          listEstablishments().catch(() => []),
        ]);

        const title = Input({ placeholder: 'Objet de l’annonce' });
        const body = Textarea({ rows: 4, placeholder: 'Message diffusé aux destinataires' });

        const scopeOptions = profile.role === 'ministry'
          ? [{ value: 'national', label: 'Tout le territoire' },
             { value: 'wilaya', label: 'Une wilaya' },
             { value: 'establishment', label: 'Un établissement' }]
          : profile.role === 'direction'
            ? [{ value: 'wilaya', label: 'Ma wilaya' },
               { value: 'establishment', label: 'Un établissement de ma wilaya' }]
            : [{ value: 'establishment', label: 'Mon établissement' }];

        const scope = Select({ value: scopeOptions[0].value, options: scopeOptions });
        const wilayaSel = Select({
          value: profile.wilaya_id || '',
          options: wilayas.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })),
        });
        const estabSel = Select({
          value: profile.establishment_id || '',
          options: estabs.map((e) => ({ value: e.id, label: e.name })),
        });
        const roleSel = Select({
          value: '',
          options: [{ value: '', label: 'Tous les rôles' },
            ...Object.entries(ROLES).map(([v, m]) => ({ value: v, label: m.label }))],
        });

        const wilayaField = Field({ label: 'Wilaya', children: wilayaSel });
        const estabField = Field({ label: 'Établissement', children: estabSel });

        function sync() {
          wilayaField.hidden = scope.value !== 'wilaya';
          estabField.hidden = scope.value !== 'establishment';
        }
        scope.addEventListener('change', sync);
        sync();

        const send = Button({ label: 'Diffuser', icon: 'send', variant: 'primary' });
        const cancel = Button({ label: 'Annuler', variant: 'secondary' });

        const m = Modal({
          title: 'Nouvelle annonce administrative',
          subtitle: 'Une notification est déposée dans l’espace de chaque destinataire.',
          size: 'md',
          children: [
            Field({ label: 'Objet', required: true, children: title }),
            Field({ label: 'Message', required: true, children: body }),
            Field({ label: 'Périmètre', children: scope }),
            wilayaField,
            estabField,
            Field({ label: 'Destinataires', children: roleSel }),
          ],
          actions: [cancel, send],
        });

        cancel.addEventListener('click', () => m.close());
        send.addEventListener('click', async () => {
          if (!title.value.trim() || !body.value.trim()) {
            toast('Objet et message sont requis.', { tone: 'warn' }); return;
          }
          const target = scope.value === 'wilaya' ? (wilayaSel.value || profile.wilaya_id)
            : scope.value === 'establishment' ? (estabSel.value || profile.establishment_id)
            : null;
          send.disabled = true;
          try {
            const n = await broadcastAnnouncement({
              p_title: title.value.trim(),
              p_body: body.value.trim(),
              p_scope: scope.value,
              p_target: target,
              p_roles: roleSel.value ? [roleSel.value] : null,
            });
            toast(`Annonce diffusée à ${n} destinataire(s).`, { tone: 'success' });
            m.close();
            reload();
          } catch (err) {
            send.disabled = false;
            toast(err.message || 'Diffusion impossible.', { tone: 'danger' });
          }
        });

        m.open();
      }

      const markAll = Button({
        label: 'Tout marquer comme lu', icon: 'check', variant: 'secondary',
        disabled: unread.length === 0,
        onClick: async () => {
          markAll.disabled = true;
          try {
            await markNotificationsRead(null);
            toast('Notifications marquées comme lues.', { tone: 'success' });
            reload();
          } catch (err) {
            markAll.disabled = false;
            toast(err.message || 'Opération impossible.', { tone: 'danger' });
          }
        },
      });

      const list = items.length === 0
        ? EmptyBlock('Aucune notification.', 'bell')
        : h('ul.notif-list', {}, items.map((n) => h('li', {
            class: `notif-item${n.read_at ? '' : ' notif-item--unread'}`,
          }, [
            h('div.notif-item__ico', {}, [Icon(KIND_ICON[n.kind] || 'bell', { size: 15 })]),
            h('div', { style: { flex: '1 1 auto', minWidth: 0 } }, [
              h('div.notif-item__title', {}, [n.title]),
              n.body && h('div.notif-item__body', {}, [n.body]),
              h('div.notif-item__when', {}, [fmtDateTime(n.created_at)]),
            ].filter(Boolean)),
            n.link && h('div', {}, [
              Button({
                label: 'Ouvrir', icon: 'arrow-right', variant: 'ghost', size: 'sm',
                onClick: async () => {
                  if (!n.read_at) { try { await markNotificationsRead([n.id]); } catch (_) {} }
                  navigate(n.link);
                },
              }),
            ]),
          ].filter(Boolean))));

      return [
        SectionHead(
          'Notifications',
          unread.length
            ? `${unread.length} non lue${unread.length > 1 ? 's' : ''} sur ${items.length}`
            : `${items.length} notification${items.length > 1 ? 's' : ''}`,
          [
            canBroadcast && Button({ label: 'Diffuser une annonce', icon: 'send',
                                     variant: 'primary', onClick: openBroadcast }),
            markAll,
          ].filter(Boolean)
        ),
        Card({ padding: 0 }, [list]),
      ];
    },
  });
}
