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
    clearSession();
    return {
      input: { loggedInFamily: familyA, families: [familyA, familyB] },
      expected: { publishedCount: 2 },
      actual: { publishedCount: view.posts.length }
    };
  });

  await test('family board shows the logged-in user\'s own family posts (public + private)', async () => {
    clearSession();

    // Family A is the first record — the pre-auth fallback used to always win.
    const firstFamily = await createFamily('The Chen Family');
    const myFamily = await createFamily('Nguyen');

    await createUser({ name: 'Popo Chen', family_id: firstFamily, email: 'popo@example.com', phone: null });
    const meId = await createUser({ name: 'Ada Nguyen', family_id: myFamily, email: 'ada@example.com', phone: null });

    await createPost({
      poster_id: 1, family_id: firstFamily, title: 'A Chen memory',
      description: '', file: null, category: 'recipe', is_published: 1
    });
    await createPost({
      poster_id: meId, family_id: myFamily, title: 'My private memory',
      description: '', file: null, category: 'recipe', is_published: 0
    });
    await createPost({
      poster_id: meId, family_id: myFamily, title: 'My shared memory',
      description: '', file: null, category: 'story', is_published: 1
    });

    localStorage.setItem('cornerStoneSession', JSON.stringify({
      id: meId, name: 'Ada Nguyen', email: 'ada@example.com', family_id: myFamily
    }));

    const view = await window.appData.loadFamilyView();
    clearSession();
    return {
      input: { firstFamily: firstFamily, myFamily: myFamily },
      expected: { familyName: 'Nguyen', titles: ['My shared memory', 'My private memory'] },
      actual: {
        familyName: view.family ? view.family.name : null,
        titles: view.posts.map(function (p) { return p.title; })
      }
    };
  });
})();
