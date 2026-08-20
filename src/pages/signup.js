import { h } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { authShell } from './auth-shell.js';
import { Field, Input, Select } from '../components/input.js';
import { Button } from '../components/button.js';
import { signUpWithPassword } from '../lib/auth.js';
import { navigate } from '../lib/router.js';
import { toast } from '../components/toast.js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase.js';

export async function signupPage() {
  // Annuaire minimal des établissements — RPC dédiée, accessible sans compte.
  // La table elle-même reste cloisonnée par wilaya / établissement (§23).
  let establishments = [];
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.rpc('public_establishments');
    if (!error && data) establishments = data;
  }
  const estabOptions = [
    { value: '', label: t('auth.establishment_pick') },
    ...establishments.map((e) => ({
      value: e.id,
      label: `${e.name}${e.wilaya_name ? ` · ${e.wilaya_code} — ${e.wilaya_name}` : ''}`,
    })),
  ];

  const errBox = h('p.field__error', { style: { display: 'none' } });
  const submitBtn = Button({ label: t('auth.submit_signup'), variant: 'primary', size: 'lg', fullWidth: true, type: 'submit' });

  const roleSel = Select({
    name: 'role',
    value: 'student',
    options: [
      { value: 'student', label: t('auth.role_student') },
      { value: 'teacher', label: t('auth.role_teacher') },
    ],
  });
  const firstName = Input({ name: 'first_name', required: true, placeholder: 'Rania' });
  const lastName  = Input({ name: 'last_name',  required: true, placeholder: 'Belkacem' });
  const phone     = Input({ name: 'phone', type: 'tel', placeholder: '+213 …' });
  const email     = Input({ name: 'email', type: 'email', required: true, autocomplete: 'email', placeholder: 'nom@etablissement.dz' });
  const password  = Input({ name: 'password', type: 'password', required: true, autocomplete: 'new-password', placeholder: '••••••••' });
  const password2 = Input({ name: 'password2', type: 'password', required: true, autocomplete: 'new-password', placeholder: '••••••••' });
  const estabSel  = Select({ name: 'establishment_id', options: estabOptions, required: true });
  const studentNumber = Input({ name: 'student_number', placeholder: '2025-INFO-042' });

  // Le champ "Numéro d'étudiant" n'est utile que pour les étudiants
  const studentNumberField = Field({ label: t('auth.student_number'), children: studentNumber });
  roleSel.addEventListener('change', () => {
    studentNumberField.style.display = roleSel.value === 'student' ? '' : 'none';
  });

  const form = h('form.auth__form', {
    style: { maxWidth: '520px' },
    onSubmit: async (e) => {
      e.preventDefault();
      errBox.style.display = 'none';

      if (!isSupabaseConfigured()) {
        errBox.textContent = t('auth.errors.supabase_unconfigured');
        errBox.style.display = '';
        return;
      }
      if (password.value.length < 8) {
        errBox.textContent = t('auth.errors.password_short');
        errBox.style.display = '';
        return;
      }
      if (password.value !== password2.value) {
        errBox.textContent = t('auth.errors.password_mismatch');
        errBox.style.display = '';
        return;
      }
      if (!estabSel.value) {
        errBox.textContent = t('auth.errors.missing');
        errBox.style.display = '';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
      try {
        await signUpWithPassword(email.value, password.value, {
          role: roleSel.value,
          first_name: firstName.value.trim(),
          last_name:  lastName.value.trim(),
          phone:      phone.value.trim() || null,
          establishment_id: estabSel.value,
          student_number: roleSel.value === 'student' ? studentNumber.value.trim() : null,
        });
        toast('Demande envoyée. En attente de validation par votre établissement.', { tone: 'success' });
        navigate('/en-attente');
      } catch (err) {
        errBox.textContent = err?.message || t('auth.errors.invalid_credentials');
        errBox.style.display = '';
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
      }
    },
  }, [
    h('p.kicker', {}, ['Cursus']),
    h('h1.auth__title', {}, [t('auth.signup_title')]),
    h('p.auth__sub', {}, [t('auth.signup_sub')]),

    Field({ label: t('auth.role'), required: true, children: roleSel }),

    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-3)' } }, [
      Field({ label: t('auth.first_name'), required: true, children: firstName }),
      Field({ label: t('auth.last_name'),  required: true, children: lastName  }),
    ]),

    Field({ label: t('auth.establishment'), required: true, children: estabSel,
      hint: establishments.length === 0 ? "Aucun établissement n'est encore enregistré. Contactez votre administration." : null,
    }),
    studentNumberField,
    Field({ label: t('auth.phone'), children: phone }),
    Field({ label: t('auth.email'), required: true, children: email }),

    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-3)' } }, [
      Field({ label: t('auth.password'),         required: true, children: password  }),
      Field({ label: t('auth.confirm_password'), required: true, children: password2 }),
    ]),

    errBox,
    h('div', { style: { margin: 'var(--s-3) 0 var(--s-5)' } }, [submitBtn]),
    h('div', { style: { fontSize: 'var(--t-body-sm)' } }, [
      h('a', { href: '/login', 'data-link': '' }, [t('auth.have_account') + ' ' + t('auth.submit_login')]),
    ]),
  ]);

  return authShell({ form });
}
