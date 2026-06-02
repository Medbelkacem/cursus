import { h } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { authShell } from './auth-shell.js';
import { Field, Input } from '../components/input.js';
import { Button } from '../components/button.js';
import { signInWithPassword, dashboardPathFor } from '../lib/auth.js';
import { navigate } from '../lib/router.js';
import { toast } from '../components/toast.js';
import { isSupabaseConfigured } from '../lib/supabase.js';

export async function loginPage() {
  const errBox = h('p.field__error', { style: { display: 'none' } });
  const submitBtn = Button({ label: t('auth.submit_login'), variant: 'primary', size: 'lg', fullWidth: true, type: 'submit' });
  const emailInput = Input({ type: 'email', name: 'email', required: true, autocomplete: 'email', placeholder: 'nom@etablissement.dz' });
  const passInput  = Input({ type: 'password', name: 'password', required: true, autocomplete: 'current-password', placeholder: '••••••••' });

  const form = h('form.auth__form', {
    onSubmit: async (e) => {
      e.preventDefault();
      errBox.style.display = 'none';
      if (!isSupabaseConfigured()) {
        errBox.textContent = t('auth.errors.supabase_unconfigured');
        errBox.style.display = '';
        return;
      }
      const email = emailInput.value.trim();
      const password = passInput.value;
      if (!email || !password) {
        errBox.textContent = t('auth.errors.missing');
        errBox.style.display = '';
        return;
      }
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
      try {
        const state = await signInWithPassword(email, password);
        toast('Connexion réussie.', { tone: 'success' });
        navigate(dashboardPathFor(state.role));
      } catch (err) {
        errBox.textContent = err?.message === 'SUPABASE_UNCONFIGURED'
          ? t('auth.errors.supabase_unconfigured')
          : t('auth.errors.invalid_credentials');
        errBox.style.display = '';
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
      }
    },
  }, [
    h('p.kicker', {}, ['Cursus']),
    h('h1.auth__title', {}, [t('auth.login_title')]),
    h('p.auth__sub', {}, [t('auth.login_sub')]),
    Field({ label: t('auth.email'),    required: true, children: emailInput }),
    Field({ label: t('auth.password'), required: true, children: passInput  }),
    errBox,
    h('div', { style: { margin: 'var(--s-3) 0 var(--s-5)' } }, [submitBtn]),
    h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-body-sm)' } }, [
      h('a', { href: '/signup', 'data-link': '' }, [t('auth.no_account') + ' ' + t('auth.submit_signup')]),
      h('a', { href: '#', onClick: (e) => { e.preventDefault(); toast('Contactez votre établissement.', { tone: 'info' }); } }, [t('auth.forgot')]),
    ]),
  ]);

  return authShell({ form });
}
