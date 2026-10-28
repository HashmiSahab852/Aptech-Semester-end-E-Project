/* Login page: front-end demo sign-in (any email and password). Session helpers live in common.js. */
(() => {
  'use strict';

  const app = window.OceanGate;
  const { $, announce, localPath, auth } = app.shared;

  // Demo login: any valid-looking email with any non-empty password is accepted, because there is no
  // database or server to check against. Never use this approach to protect real data.
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const grid = $('#login-grid');
  const form = $('#login-form');
  const emailInput = $('#login-email');
  const passwordInput = $('#login-password');
  const passwordToggle = $('#login-password-toggle');
  const submit = $('#login-submit');
  const formError = $('#login-error');
  const context = $('#login-context');
  const signedIn = $('#login-signed-in');

  // Where to go afterwards: the page the visitor came from (checked to be inside this site), else home.
  const nextURL = auth.resolveNext(new URLSearchParams(location.search).get('next'));
  let redirecting = false;

  function setFieldError(input, message) {
    $(`#${input.id}-error`).textContent = message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function clearErrors() {
    setFieldError(emailInput, '');
    setFieldError(passwordInput, '');
    formError.textContent = '';
  }

  function validate() {
    const email = emailInput.value.trim();
    let emailMessage = '';
    if (!email) emailMessage = 'Enter your email address.';
    else if (!EMAIL_PATTERN.test(email)) emailMessage = 'Enter a valid email address, like name@example.com.';
    const passwordMessage = passwordInput.value ? '' : 'Enter your password.';
    setFieldError(emailInput, emailMessage);
    setFieldError(passwordInput, passwordMessage);
    if (emailMessage) emailInput.focus();
    else if (passwordMessage) passwordInput.focus();
    return !emailMessage && !passwordMessage;
  }

  // A friendly name from the email: "ali.khan99@gmail.com" becomes "Ali.khan99".
  function displayName(email) {
    const name = email.split('@')[0].slice(0, 40);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  function onSubmit(event) {
    event.preventDefault();
    formError.textContent = '';
    if (!validate()) return;
    const email = emailInput.value.trim().toLowerCase();
    redirecting = true;
    if (!auth.login({ name: displayName(email), email })) {
      redirecting = false;
      formError.textContent = 'Your browser is blocking site storage, so this login cannot be kept. Allow site data for this page and try again.';
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Logging in…';
    // Replace the login page in the history so the Back button does not return to it.
    location.replace(nextURL ? nextURL.href : localPath('index.html'));
  }

  function togglePassword() {
    const reveal = passwordInput.type === 'password';
    passwordInput.type = reveal ? 'text' : 'password';
    passwordToggle.textContent = reveal ? 'Hide' : 'Show';
    passwordToggle.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
  }

  // Shows the form, or a short summary when the visitor is already logged in.
  function render() {
    if (redirecting) return;
    const user = auth.user();
    grid.hidden = Boolean(user);
    signedIn.hidden = !user;
    if (!user) return;
    $('#login-user-name').textContent = user.name;
    $('#login-user-email').textContent = user.email;
  }

  function initializeLogin() {
    // Already logged in and heading somewhere (for example checkout): no need to ask again.
    if (nextURL && auth.isLoggedIn()) {
      redirecting = true;
      location.replace(nextURL.href);
      return;
    }
    if (nextURL?.searchParams.has('checkout')) {
      context.textContent = 'Log in to continue to checkout. Your bag is exactly as you left it.';
      context.hidden = false;
    }

    form.addEventListener('submit', onSubmit);
    passwordToggle.addEventListener('click', togglePassword);
    emailInput.addEventListener('input', () => setFieldError(emailInput, ''));
    passwordInput.addEventListener('input', () => setFieldError(passwordInput, ''));
    $('#login-signed-out').addEventListener('click', () => {
        auth.logout();
        announce('You have been logged out.');
      });
    // Stay in step with the navigation menu, other tabs, and the browser's back/forward cache.
    window.addEventListener('oceangate:authchange', render);
    window.addEventListener('pageshow', event => {
        if (!event.persisted) return;
        submit.disabled = false;
        submit.textContent = 'Log in →';
        redirecting = false;
        render();
      });
    render();
  }

  // The shared navigation (bag count, links that keep the bag) starts with the catalogue, but the
  // form itself does not depend on it, so it is set up straight away.
  app.start();
  initializeLogin();
})();
