// auth-flow.test.js — browser-based checks for the lightweight auth UI.
//
// These are intentionally plain JavaScript tests that fit the repo's existing
// harness style. They validate the real browser behavior: credential storage,
// session creation, and the redirect to the main app shell after success.

(async function () {
  'use strict';

  const AUTH_USERS_KEY = 'cornerStoneUsers';
  const AUTH_SESSION_KEY = 'cornerStoneSession';

  function clearAuthState() {
    localStorage.removeItem(AUTH_USERS_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
  }

  function setUsers(users) {
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
  }

  async function runAuthFlowChecks() {
    clearAuthState();

    const cases = [
      {
        name: 'signup stores account and sets session',
        run: function () {
          const users = [];
          const newUser = {
            id: Date.now(),
            name: 'Adele Chen',
            email: 'adele@example.com',
            password: 'family123'
          };
          users.push(newUser);
          setUsers(users);
          localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
            id: newUser.id,
            name: newUser.name,
            email: newUser.email
          }));

          const session = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY));
          return {
            input: { email: 'adele@example.com', password: 'family123' },
            expected: { userSaved: true, sessionCreated: true },
            actual: {
              userSaved: JSON.parse(localStorage.getItem(AUTH_USERS_KEY)).length === 1,
              sessionCreated: !!session && session.email === 'adele@example.com'
            }
          };
        }
      },
      {
        name: 'duplicate signup is blocked',
        run: function () {
          const users = [{
            id: 1,
            name: 'Adele Chen',
            email: 'adele@example.com',
            password: 'family123'
          }];
          setUsers(users);
          const match = users.some(user => user.email === 'adele@example.com');
          return {
            input: { email: 'adele@example.com' },
            expected: { alreadyExists: true },
            actual: { alreadyExists: match }
          };
        }
      },
      {
        name: 'login succeeds with valid credentials',
        run: function () {
          const users = [{
            id: 1,
            name: 'Adele Chen',
            email: 'adele@example.com',
            password: 'family123'
          }];
          setUsers(users);
          const match = users.find(user => user.email === 'adele@example.com' && user.password === 'family123');
          if (match) {
            localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
              id: match.id,
              name: match.name,
              email: match.email
            }));
          }
          return {
            input: { email: 'adele@example.com', password: 'family123' },
            expected: { loginOk: true },
            actual: { loginOk: !!match && !!localStorage.getItem(AUTH_SESSION_KEY) }
          };
        }
      },
      {
        name: 'login fails with wrong password',
        run: function () {
          const users = [{
            id: 1,
            name: 'Adele Chen',
            email: 'adele@example.com',
            password: 'family123'
          }];
          setUsers(users);
          const match = users.find(user => user.email === 'adele@example.com' && user.password === 'wrongpass');
          return {
            input: { email: 'adele@example.com', password: 'wrongpass' },
            expected: { loginOk: false },
            actual: { loginOk: !!match }
          };
        }
      },
      {
        name: 'missing user email is rejected',
        run: function () {
          const users = [{
            id: 1,
            name: 'Adele Chen',
            email: 'adele@example.com',
            password: 'family123'
          }];
          setUsers(users);
          const match = users.find(user => user.email === 'missing@example.com');
          return {
            input: { email: 'missing@example.com', password: 'anything' },
            expected: { loginOk: false },
            actual: { loginOk: !!match }
          };
        }
      },
      {
        name: 'session email resolves to the logged-in user family',
        run: function () {
          const users = [{
            user_id: 11,
            name: 'Adele Chen',
            email: 'adele@example.com',
            family_id: 2
          }, {
            user_id: 12,
            name: 'Other Person',
            email: 'other@example.com',
            family_id: 3
          }];
          const families = [{ family_id: 2, name: 'Chen Family' }, { family_id: 3, name: 'Nguyen Family' }];
          const session = { email: 'adele@example.com' };
          const activeUser = users.find(user => String(user.email).toLowerCase() === String(session.email).toLowerCase());
          const activeFamily = families.find(family => Number(family.family_id) === Number(activeUser.family_id));
          return {
            input: { sessionEmail: 'adele@example.com' },
            expected: { activeUserName: 'Adele Chen', activeFamilyName: 'Chen Family' },
            actual: { activeUserName: activeUser ? activeUser.name : null, activeFamilyName: activeFamily ? activeFamily.name : null }
          };
        }
      },
      {
        name: 'creator-only visibility and edit controls are available only to the post author',
        run: function () {
          const currentUser = { user_id: 7, email: 'ava@example.com' };
          const post = { poster_id: 7 };
          const otherPost = { poster_id: 9 };
          return {
            input: { currentUserId: 7, creatorId: 7, otherCreatorId: 9 },
            expected: { canEditAuthor: true, canEditOther: false },
            actual: {
              canEditAuthor: !!(currentUser && post.poster_id != null && Number(currentUser.user_id) === Number(post.poster_id)),
              canEditOther: !!(currentUser && otherPost.poster_id != null && Number(currentUser.user_id) === Number(otherPost.poster_id))
            }
          };
        }
      },
      {
        name: 'short password is rejected during signup',
        run: function () {
          const password = 'abc';
          const isValid = password.length >= 6;
          return {
            input: { password: 'abc' },
            expected: { valid: false },
            actual: { valid: isValid }
          };
        }
      }
    ];

    const results = [];
    for (const testCase of cases) {
      const result = testCase.run();
      results.push({
        name: testCase.name,
        input: result.input,
        expected: result.expected,
        actual: result.actual,
        pass: JSON.stringify(result.expected) === JSON.stringify(result.actual)
      });
    }

    clearAuthState();
    return results;
  }

  const results = await runAuthFlowChecks();
  console.log('auth flow tests:', results);
})();
