// Écran "En attente de validation" / "Refusé".
// Affiche le statut tel qu'il est dans le profil et déconnecte au besoin.

import { h } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { Wordmark } from '../components/wordmark.js';
import { Button } from '../components/button.js';
import { Icon } from '../components/icon.js';
import { LangSwitcher, ThemeToggle } from '../components/lang-theme.js';
import { signOut, getState } from '../lib/auth.js';
import { navigate } from '../lib/router.js';

export async function pendingPage() { return statusPage('pending'); }
export async function rejectedPage() { return statusPage('rejected'); }

function statusPage(kind) {
  const isRej = kind === 'rejected';
  const state = getState();

  return h('div.auth', {}, [
    h('aside.auth__side', {}, [
      h('div.auth__side-inner', {}, [
        Wordmark({ size: 'sm', variant: 'inverse', linked: true }),
        h('div', { style: { marginTop: 'var(--s-12)', width: 80, height: 80, borderRadius: 16, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
          [Icon(isRej ? 'alert' : 'clock', { size: 36 })]),
        h('h2', {}, [t(isRej ? 'auth.rejected_title' : 'auth.pending_title')]),
        h('p', {}, [t(isRej ? 'auth.rejected_lede' : 'auth.pending_lede')]),
      ]),
      h('div.auth__side-foot', {}, [state.user?.email || '']),
    ]),

    h('main.auth__main', { id: 'main-content', role: 'main', tabindex: '-1' }, [
      h('header.auth__head', {}, [
        Wordmark({ size: 'sm', linked: true }),
        h('div.auth__head-actions', {}, [LangSwitcher(), ThemeToggle()]),
      ]),
      h('div.auth__form', {}, [
        h('p.kicker', {}, [isRej ? 'Compte refusé' : 'Compte en attente']),
        h('h1.auth__title', {}, [t(isRej ? 'auth.rejected_title' : 'auth.pending_title')]),
        h('p.auth__sub', {}, [
          isRej ? t('auth.rejected_lede') : t('auth.pending_lede'),
        ]),
        !isRej && h('div', {
          style: {
            padding: 'var(--s-4)',
            background: 'var(--c-gauloise-50)',
            border: '1px solid var(--c-gauloise-100)',
            borderRadius: 'var(--r-md)',
            fontSize: 'var(--t-body-sm)',
            color: 'var(--c-gauloise-d)',
            marginBottom: 'var(--s-5)',
          },
        }, [t('auth.pending_note')]),
        h('div', { style: { display: 'flex', gap: 'var(--s-3)' } }, [
          Button({
            label: t('common.logout'),
            variant: 'secondary',
            onClick: async () => {
              await signOut();
              navigate('/login');
            },
          }),
          Button({ label: 'Actualiser', variant: 'ghost', onClick: () => window.location.reload() }),
        ]),
      ].filter(Boolean)),
    ]),
  ]);
}
