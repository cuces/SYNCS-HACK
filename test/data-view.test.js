// data-view.test.js — regressions for the logged-in user view-models.
// These checks exercise the real browser state: localStorage session + Dexie DB.

(async function () {
  'use strict';

  function clearSession() {
    localStorage.removeItem('cornerStoneSession');
  }

  await test('community view shows all published posts even when a user is logged in', async () => {
    clearSession();

    const familyA = await createFamily('Nguyen');
    const familyB = await createFamily('Chen');

    await createUser({ name: 'Ada Nguyen', family_id: familyA, email: 'ada@example.com', phone: null });
    await createUser({ name: 'Ben Chen', family_id: familyB, email: 'ben@example.com', phone: null });

    await createPost({
      poster_id: 1,
      family_id: familyA,
      title: 'A public family memory',
      description: '',
      file: null,
      category: 'recipe',
      tags: ['vietnamese'],
      is_published: 1
    });

    await createPost({
      poster_id: 2,
      family_id: familyB,
      title: 'Another public family memory',
      description: '',
      file: null,
      category: 'story',
      tags: ['chinese'],
      is_published: 1
    });

    localStorage.setItem('cornerStoneSession', JSON.stringify({
      id: 1,
      name: 'Ada Nguyen',
      email: 'ada@example.com',
      family_id: familyA
    }));

    const view = await window.appData.loadCommunityView();
    return {
      input: { loggedInFamily: familyA, families: [familyA, familyB] },
      expected: { publishedCount: 2 },
      actual: { publishedCount: view.posts.length }
    };
  });
})();
