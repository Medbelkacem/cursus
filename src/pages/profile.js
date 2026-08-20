// Profil utilisateur — affichage et modification (prénom, nom, téléphone, langue préférée, mot de passe).

import { h } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { requireAuth, signOut } from '../lib/auth.js';
import { navigate } from '../lib/router.js';
import { AppShell } from '../components/layout.js';
import { Card } from '../components/card.js';
import { Button } from '../components/button.js';
import { Field, Input, Select } from '../components/input.js';
import { Badge } from '../components/badge.js';
import { navFor, roleLabel, initialsOf } from '../lib/nav.js';
import { getApi } from '../lib/api.js';
import { toast } from '../components/toast.js';
import { fmtDate, ErrorBlock } from '../lib/page-helpers.js';

export async function profilePage() {
  const guard = requireAuth();
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile, user, role } = guard.state;

  const sb = getApi();
  let extra = null, err = null;
  if (sb) {
    if (role === 'student') {
      const r = await sb.from('students').select('student_number, level, enrollment_date, specialty_id, group_id, specialties(name), groups(name)').eq('profile_id', user.id).maybeSingle();
      if (!r.error) extra = { kind: 'student', ...r.data };
    } else if (role === 'teacher') {
      const r = await sb.from('teachers').select('employee_number, hired_at, establishment_id').eq('profile_id', user.id).maybeSingle();
      if (!r.error) extra = { kind: 'teacher', ...r.data };
    }
  }

  const firstName = Input({ value: profile?.first_name || '' });
  const lastName  = Input({ value: profile?.last_name  || '' });
  const phone     = Input({ type: 'tel',   value: profile?.phone || '' });
  const langSel   = Select({ value: profile?.preferred_language || 'fr', options: [
    { value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' },
  ]});

  const pwd1 = Input({ type: 'password', autocomplete: 'new-password' });
  const pwd2 = Input({ type: 'password', autocomplete: 'new-password' });

  const children = [
    err && ErrorBlock(err),
    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-4)' } }, [
      // ── Identité ────────────────────────────────────────────────────
      Card({ padding: 20 }, [
        h('h3.card__title', {}, ['Identité']),
        h('p.mute', { style: { margin: '4px 0 16px', fontSize: 13 } },
          ['Modifiez vos informations personnelles. L\'e-mail ne peut être changé que via votre administration.']),
        h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-3)' } }, [
          Field({ label: 'Prénom', children: firstName }),
          Field({ label: 'Nom', children: lastName }),
        ]),
        Field({ label: 'Téléphone', children: phone }),
        Field({ label: 'Langue préférée', children: langSel }),
        h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: 12 } }, [
          Button({ label: t('common.save'), icon: 'check-circle', variant: 'primary',
            onClick: async () => {
              if (!sb) return;
              const r = await sb.from('profiles').update({
                first_name: firstName.value.trim(),
                last_name:  lastName.value.trim(),
                phone:      phone.value.trim() || null,
                preferred_language: langSel.value,
              }).eq('id', user.id);
              if (r.error) toast(r.error.message, { tone: 'danger' });
              else toast('Profil enregistré.', { tone: 'success' });
            },
          }),
        ]),
      ]),

      // ── Compte ──────────────────────────────────────────────────────
      Card({ padding: 20 }, [
        h('h3.card__title', {}, ['Compte']),
        h('p.mute', { style: { margin: '4px 0 16px', fontSize: 13 } },
          ['Changez votre mot de passe ou déconnectez-vous.']),
        h('dl', { style: { display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 16px', margin: '0 0 16px', fontSize: 13 } }, [
          h('dt.mute', {}, ['E-mail']),       h('dd', { class: 'mono' }, [profile?.email || '—']),
          h('dt.mute', {}, ['Rôle']),         h('dd', {}, [Badge({ tone: 'outline' }, [roleLabel(role)])]),
          h('dt.mute', {}, ['Statut']),       h('dd', {}, [Badge({ tone: profile?.status === 'active' ? 'success' : 'warn' }, [profile?.status || '—'])]),
          h('dt.mute', {}, ['Inscrit le']),   h('dd', { class: 'mono small mute' }, [fmtDate(profile?.created_at)]),
        ]),
        h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-3)' } }, [
          Field({ label: 'Nouveau mot de passe', children: pwd1 }),
          Field({ label: 'Confirmer', children: pwd2 }),
        ]),
        h('div', { style: { display: 'flex', gap: 'var(--s-2)', justifyContent: 'space-between', marginTop: 12 } }, [
          Button({ label: 'Mettre à jour', variant: 'secondary',
            onClick: async () => {
              if (!sb) return;
              if (pwd1.value.length < 8) { toast('Mot de passe trop court (8 min).', { tone: 'warn' }); return; }
              if (pwd1.value !== pwd2.value) { toast('Les mots de passe ne correspondent pas.', { tone: 'warn' }); return; }
              const r = await sb.auth.updateUser({ password: pwd1.value });
              if (r.error) toast(r.error.message, { tone: 'danger' });
              else { toast('Mot de passe mis à jour.', { tone: 'success' }); pwd1.value = ''; pwd2.value = ''; }
            },
          }),
          Button({ label: t('common.logout'), variant: 'ghost', icon: 'logout',
            onClick: async () => { await signOut(); navigate('/login'); },
          }),
        ]),
      ]),
    ]),

    extra && extra.kind === 'student' && h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 20 }, [
        h('h3.card__title', {}, ['Scolarité']),
        h('dl', { style: { display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 16px', margin: '12px 0 0', fontSize: 14 } }, [
          h('dt.mute', {}, ['Numéro étudiant']),  h('dd', { class: 'mono' }, [extra.student_number || '—']),
          h('dt.mute', {}, ['Spécialité']),       h('dd', {}, [extra.specialties?.name || '—']),
          h('dt.mute', {}, ['Groupe']),           h('dd', {}, [extra.groups?.name || '—']),
          h('dt.mute', {}, ['Niveau']),           h('dd', {}, [extra.level || '—']),
          h('dt.mute', {}, ['Inscription']),      h('dd', { class: 'mono small mute' }, [fmtDate(extra.enrollment_date)]),
        ]),
      ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor(role),
    active: t('common.my_profile'),
    role: roleLabel(role),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Mon profil',
    breadcrumb: `${roleLabel(role)} · Profil`,
    children,
  });
}
