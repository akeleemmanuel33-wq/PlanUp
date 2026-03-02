// ============================================================
// js/pages/auth.js — Login / Register / Google OAuth
// ============================================================

import { supabase } from '../api/supabase.js';
import { $, setLoading } from '../utils/dom.js';

// ── State ─────────────────────────────────────────────────────
let mode = 'login'; // 'login' | 'register'

// ── DOM refs ──────────────────────────────────────────────────
const form        = $('#auth-form');
const emailInput  = $('#auth-email');
const passInput   = $('#auth-password');
const nameInput   = $('#auth-name');
const nameGroup   = $('#name-group');
const submitBtn   = $('#auth-submit');
const errorEl     = $('#auth-error');
const toggleLink  = $('#auth-toggle-link');
const toggleText  = $('#auth-toggle-text');
const heading     = $('#auth-heading');
const subheading  = $('#auth-subheading');
const googleBtn   = $('#google-btn');

// ── Redirect if already logged in ────────────────────────────
const { data: { session } } = await supabase.auth.getSession();
if (session) window.location.replace('/pages/app.html');

// ── Toggle login / register ───────────────────────────────────
function setMode(newMode) {
  mode = newMode;

  if (mode === 'register') {
    heading.textContent     = 'Create an account';
    subheading.textContent  = 'Start planning your day with PlanUp';
    submitBtn.textContent   = 'Create account';
    toggleText.textContent  = 'Already have an account?';
    toggleLink.textContent  = ' Sign in';
    nameGroup.style.display = '';
    nameInput.required      = true;
  } else {
    heading.textContent     = 'Welcome back';
    subheading.textContent  = 'Sign in to continue to PlanUp';
    submitBtn.textContent   = 'Sign in';
    toggleText.textContent  = "Don't have an account?";
    toggleLink.textContent  = ' Sign up';
    nameGroup.style.display = 'none';
    nameInput.required      = false;
  }

  hideError();
}

toggleLink.addEventListener('click', () => {
  setMode(mode === 'login' ? 'register' : 'login');
});

// ── Show / hide error ─────────────────────────────────────────
function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add('visible');
}

function hideError() {
  errorEl.classList.remove('visible');
}

// ── Form submit ────────────────────────────────────────────────
form.addEventListener('submit', async () => {
  hideError();
  const email    = emailInput.value.trim();
  const password = passInput.value;

  if (!email || !password) return showError('Please fill in all fields.');
  if (password.length < 6)  return showError('Password must be at least 6 characters.');

  setLoading(submitBtn, true);

  let error;

  if (mode === 'register') {
    const name = nameInput.value.trim();
    const res = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    error = res.error;

    if (!error) {
      showError('✅ Check your email to confirm your account, then sign in.');
      errorEl.style.background  = 'var(--green-light)';
      errorEl.style.borderColor = 'var(--green)';
      errorEl.style.color       = 'var(--green)';
      setLoading(submitBtn, false);
      return;
    }
  } else {
    const res = await supabase.auth.signInWithPassword({ email, password });
    error = res.error;
  }

  setLoading(submitBtn, false);

  if (error) return showError(error.message);
  window.location.replace('/pages/app.html');
});

// ── Google OAuth ───────────────────────────────────────────────
googleBtn.addEventListener('click', async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/pages/app.html` },
  });
  if (error) showError(error.message);
});