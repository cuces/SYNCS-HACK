// auth.js — lightweight browser auth for the static demo app.
//
// This project does not yet have a server-side identity layer, so the login and
// signup pages persist account data in localStorage instead. The flow is simple
// and intentionally explicit: users are stored as plain JSON, a session is set
// on success, and the user is redirected into the main app shell.

(function () {
  'use strict';

  const USERS_KEY = 'cornerStoneUsers';
  const SESSION_KEY = 'cornerStoneSession';

  function readUsers() {
    try {
      const value = localStorage.getItem(USERS_KEY);
      return value ? JSON.parse(value) : [];
    } catch (error) {
      console.error('Could not read stored users:', error);
      return [];
    }
  }

  function writeUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function setCurrentUser(user) {
    const session = {
      id: user.id,
      name: user.name,
      email: user.email,
      family_id: user.family_id != null ? user.family_id : null
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function getCurrentUser() {
    try {
      const value = localStorage.getItem(SESSION_KEY);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Could not read active session:', error);
      return null;
    }
  }

  // Expose the auth state as a small shared API so the rest of the site can
  // resolve the logged-in user without duplicating localStorage access logic.
  function getCurrentUserEmail() {
    const user = getCurrentUser();
    return user && user.email ? String(user.email).trim().toLowerCase() : '';
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function setMessage(element, message, isError) {
    if (!element) return;
    element.textContent = message || '';
    element.classList.toggle('auth-message-error', Boolean(isError));
    element.classList.toggle('auth-message-success', !isError && Boolean(message));
  }

  function redirectToApp() {
    window.location.href = 'index.html';
  }

  function handleLoginSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const messageEl = document.getElementById('authMessage');

    const email = normalizeEmail(emailInput.value);
    const password = String(passwordInput.value || '');
    const users = readUsers();
    const match = users.find(function (user) {
      return normalizeEmail(user.email) === email;
    });

    if (!match) {
      setMessage(messageEl, 'No account matches that email address.', true);
      return;
    }

    if (match.password !== password) {
      setMessage(messageEl, 'The password is incorrect. Please try again.', true);
      return;
    }

    setCurrentUser(match);
    setMessage(messageEl, 'Signing you in…', false);
    window.setTimeout(redirectToApp, 180);
    form.reset();
  }

  async function handleSignupSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const nameInput = document.getElementById('signupName');
    const emailInput = document.getElementById('signupEmail');
    const passwordInput = document.getElementById('signupPassword');
    const messageEl = document.getElementById('authMessage');

    const name = String(nameInput.value || '').trim();
    const email = normalizeEmail(emailInput.value);
    const password = String(passwordInput.value || '');

    if (!name || !email || !password) {
      setMessage(messageEl, 'Please complete every field before continuing.', true);
      return;
    }

    if (password.length < 6) {
      setMessage(messageEl, 'Use a password with at least 6 characters.', true);
      return;
    }

    const users = readUsers();
    const alreadyExists = users.some(function (user) {
      return normalizeEmail(user.email) === email;
    });

    if (alreadyExists) {
      setMessage(messageEl, 'An account already exists for that email address.', true);
      return;
    }

    let familyId = null;
    if (typeof window.createFamily === 'function') {
      familyId = await window.createFamily(name + "'s Family");
    }

    const newUser = {
      id: Date.now(),
      name: name,
      email: email,
      password: password,
      family_id: familyId,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeUsers(users);
    setCurrentUser(newUser);

    if (typeof window.createUser === 'function' && familyId != null) {
      await window.createUser({
        name: name,
        family_id: familyId,
        email: email,
        phone: null
      });
    }

    setMessage(messageEl, 'Account created successfully. Redirecting…', false);
    window.setTimeout(redirectToApp, 180);
    form.reset();
  }

  function initAuthPage() {
    const mode = document.body && document.body.dataset && document.body.dataset.authMode;

    // Only the actual auth screens should redirect based on an existing session.
    // The rest of the app should load normally even if a session is present, or
    // else every page would keep reloading back to index.html.
    if (!mode) return;

    const currentUser = getCurrentUser();
    if (currentUser) {
      redirectToApp();
      return;
    }

    if (mode === 'login') {
      const form = document.getElementById('loginForm');
      if (form) {
        form.addEventListener('submit', handleLoginSubmit);
      }
    }

    if (mode === 'signup') {
      const form = document.getElementById('signupForm');
      if (form) {
        form.addEventListener('submit', handleSignupSubmit);
      }
    }
  }

  initAuthPage();

  window.cornerStoneAuth = {
    getCurrentUser: getCurrentUser,
    getCurrentUserEmail: getCurrentUserEmail,
    readUsers: readUsers,
    writeUsers: writeUsers,
    setCurrentUser: setCurrentUser
  };
})();
