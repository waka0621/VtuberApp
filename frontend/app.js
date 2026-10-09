const API_URL = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || 'http://localhost:5000/api';

document.addEventListener('DOMContentLoaded', () => {
  const themeButtons = document.querySelectorAll('[data-theme]');
  themeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const theme = button.dataset.theme;
      if (!theme) return;

      document.body.classList.remove('theme-simple', 'theme-pop', 'theme-cool', 'theme-cute');
      document.body.classList.add(`theme-${theme}`);

      themeButtons.forEach((themeButton) => {
        themeButton.setAttribute('aria-pressed', String(themeButton === button));
      });
    });
  });

  const btn = document.getElementById('showJson');
  if (btn) btn.addEventListener('click', loadTableJson);

  const addUserBtn = document.getElementById('addUserButton');
  if (addUserBtn) addUserBtn.addEventListener('click', insertUsers);

  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', loginUser);

  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) logoutButton.addEventListener('click', logoutUser);

  const deleteVtuberBtn = document.getElementById('deleteVtuberButton');
  if (deleteVtuberBtn) deleteVtuberBtn.addEventListener('click', deleteVtuberData);

  const addLinkBtn = document.getElementById('addLinkButton');
  if (addLinkBtn) addLinkBtn.addEventListener('click', insertVtuberLink);

  const showLinksBtn = document.getElementById('showLinks');
  if (showLinksBtn) showLinksBtn.addEventListener('click', loadLinkJson);

  const form = document.getElementById('vtuberForm');
  if (form) form.addEventListener('submit', insertVtuber);

  const deleteLinkBtn = document.getElementById('deleteLinkButton');
  if (deleteLinkBtn) deleteLinkBtn.addEventListener('click', deleteVtuberLinkData);

  const addFavoriteBtn = document.getElementById('addFavoriteButton');
  if (addFavoriteBtn) addFavoriteBtn.addEventListener('click', insertUserFavorite);

  document.getElementById('favoriteMessage').textContent =
    sessionStorage.getItem('authToken')
      ? 'ユーザー登録済みです。推しを登録できます。'
      : '推しを登録するには、先にユーザー登録してください。';

  restoreSession();
  loadTableJson();
  loadLinkJson();
});

async function loginUser(event) {
  event.preventDefault();

  const message = document.getElementById('loginMessage');
  const nickname = document.getElementById('loginNickname').value.trim();
  const password = document.getElementById('loginPassword').value;
  message.textContent = 'ログイン中...';

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ identifier: nickname, password })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `ログインに失敗しました: ${response.status}`);
    }

    sessionStorage.setItem('authToken', data.token);
    document.getElementById('loginPassword').value = '';
    await loadMyPage();
  } catch (error) {
    console.error(error);
    message.textContent = `エラー: ${error.message}`;
  }
}

async function restoreSession() {
  if (!sessionStorage.getItem('authToken')) return;

  try {
    await loadMyPage();
  } catch (error) {
    console.error(error);
    document.getElementById('loginMessage').textContent =
      `マイページを読み込めませんでした: ${error.message}`;
  }
}

async function loadMyPage() {
  const token = sessionStorage.getItem('authToken');
  if (!token) return;

  const response = await fetch(`${API_URL}/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const data = await response.json();

  if (response.status === 401) {
    sessionStorage.removeItem('authToken');
    document.getElementById('myAccount').hidden = true;
    document.getElementById('loginArea').hidden = false;
    document.getElementById('registerArea').hidden = false;
    document.getElementById('loginMessage').textContent =
      data.error || 'ログインの有効期限が切れました。再度ログインしてください。';
    throw new Error(data.error || 'ログインの有効期限が切れました。');
  }
  if (!response.ok) {
    throw new Error(data.error || `マイページの読み込みに失敗しました: ${response.status}`);
  }

  document.getElementById('myProfile').textContent = `${data.user.nickname} さん`;
  const favoritesList = document.getElementById('myFavorites');
  favoritesList.replaceChildren();

  if (data.favorites.length === 0) {
    const emptyMessage = document.createElement('li');
    emptyMessage.textContent = 'まだ推しが登録されていません。';
    favoritesList.appendChild(emptyMessage);
  } else {
    data.favorites.forEach((favorite) => {
      const item = document.createElement('li');
      item.className = 'favorite-item';
      const name = document.createElement('strong');
      name.textContent = favorite.name;
      item.appendChild(name);

      const details = [favorite.group_name, favorite.gender].filter(Boolean);
      if (details.length > 0) {
        const description = document.createElement('span');
        description.textContent = details.join(' ・ ');
        item.appendChild(description);
      }
      favoritesList.appendChild(item);
    });
  }

  document.getElementById('registerArea').hidden = true;
  document.getElementById('loginArea').hidden = true;
  document.getElementById('myAccount').hidden = false;
  document.getElementById('favoriteMessage').textContent =
    'ユーザー登録済みです。推しを登録できます。';
}

function logoutUser() {
  sessionStorage.removeItem('authToken');
  document.getElementById('myAccount').hidden = true;
  document.getElementById('loginArea').hidden = false;
  document.getElementById('registerArea').hidden = false;
  document.getElementById('myFavorites').replaceChildren();
  document.getElementById('myProfile').textContent = '';
  document.getElementById('loginMessage').textContent = 'ログアウトしました。';
  document.getElementById('favoriteMessage').textContent =
    '推しを登録するには、先にログインしてください。';
}

async function insertUsers(event) {
  event.preventDefault();

  const pre = document.getElementById('userJson');
  if (!pre) return;

  const nickname = document.getElementById('userNickname').value.trim();
  const password = document.getElementById('userPassword').value;

  if (!nickname || !password) {
    pre.textContent = 'nickname と password を入力してください。';
    return;
  }

  pre.textContent = '送信中...';

  try {
    const response = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nickname,
        password
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`登録に失敗しました: ${response.status} ${text}`);
    }

    const data = await response.json();
    sessionStorage.setItem('authToken', data.token);
    pre.textContent = `登録しました: ${data.nickname} さん。推しを登録できます。`;
    document.getElementById('favoriteMessage').textContent =
      'ユーザー登録済みです。推しを登録できます。';
    document.getElementById('userPassword').value = '';
    await loadMyPage();
  } catch (error) {
    console.error(error);
    pre.textContent = `エラー: ${error.message}`;
  }
}

async function insertVtuber(event) {
  event.preventDefault();

  const pre = document.getElementById('tableJson');
  if (!pre) return;

  const name = document.getElementById('vtuberName').value;
  const gender = document.getElementById('vtuberGender').value;
  const groupName = document.getElementById('vtuberGroupName').value;
  const birthday = document.getElementById('vtuberBirthday').value;
  const colorCode = document.getElementById('vtuberColorCode').value;
  const notes = document.getElementById('vtuberNotes').value;

  pre.textContent = '送信中...';

  try {
    const response = await fetch(`${API_URL}/vtubers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        gender,
        group_name: groupName,
        birthday,
        color_code: colorCode,
        notes
      })
    });

    if (!response.ok) {
      throw new Error(`登録に失敗しました: ${response.status}`);
    }

    await loadTableJson();
  } catch (error) {
    console.error(error);
    pre.textContent = `エラー: ${error.message}`;
  }
}

async function insertVtuberLink(event) {
  const pre = document.getElementById('linksJson');
  if (!pre) return;

  const vtuberId = document.getElementById('linkVtuberId').value.trim();
  const siteName = document.getElementById('linkSiteName').value.trim();
  const url = document.getElementById('linkUrl').value.trim();
  const notes = document.getElementById('linkNotes').value.trim();

  if (!vtuberId) {
    pre.textContent = 'vtuber_idは必須です。';
    return;
  }

  pre.textContent = 'リンク登録中...';

  try {
    const response = await fetch(`${API_URL}/vtuber_links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        vtuber_id: Number(vtuberId),
        site_name: siteName || null,
        url,
        notes: notes || null
      })
    });

    if (!response.ok) {
      throw new Error(`登録に失敗しました: ${response.status}`);
    }

    const data = await response.json();
    pre.textContent = `リンク登録しました: ${JSON.stringify(data, null, 2)}`;

    await loadLinkJson();
  } catch (error) {
    console.error(error);
    pre.textContent = `エラー: ${error.message}`;
  }
}

async function deleteVtuberData(event) {
  event.preventDefault();

  const pre = document.getElementById('tableJson');
  if (!pre) return;

  const vtuberId = document.getElementById('deleteVtuberId').value.trim();
  if (!vtuberId) {
    pre.textContent = '削除する vtuber_id を入力してください。';
    return;
  }

  pre.textContent = `vtuber_id=${vtuberId} を削除中...`;

  try {
    const response = await fetch(`${API_URL}/vtubers/${encodeURIComponent(vtuberId)}`, {
      method: 'DELETE'
    });

    if (response.status === 404) {
      pre.textContent = `vtuber_id=${vtuberId} は見つかりませんでした。`;
      return;
    }

    if (!response.ok) {
      throw new Error(`削除に失敗しました: ${response.status}`);
    }

    const data = await response.json();
    pre.textContent = `削除しました: ${JSON.stringify(data.deleted, null, 2)}`;
    await loadTableJson();
  } catch (error) {
    console.error(error);
    pre.textContent = `エラー: ${error.message}`;
  }
}

async function loadTableJson() {
  const pre = document.getElementById('tableJson');
  if (!pre) return;
  pre.textContent = '読み込み中...';

  try {
    const response = await fetch(`${API_URL}/vtubers`);
    const tableData = await response.json();
    pre.textContent = JSON.stringify(tableData, null, 2);
  } catch (error) {
    pre.textContent = `エラー: ${error.message}`;
  }
}

async function loadLinkJson() {
  const pre = document.getElementById('linksJson');
  if (!pre) return;
  pre.textContent = 'リンク一覧を読み込み中...';

    try {
    const response = await fetch(`${API_URL}/vtuber_links`);
    const linkData = await response.json();
    pre.textContent = JSON.stringify(linkData, null, 2);
  } catch (error) {
    pre.textContent = `エラー: ${error.message}`;
  }
}

async function deleteVtuberLinkData(event) {
  event.preventDefault();

  const pre = document.getElementById('linksJson');
  if (!pre) return;

  const linkId = document.getElementById('deleteLinkId').value.trim();
  if (!linkId) {
    pre.textContent = '削除する link_id を入力してください。';
    return;
  }

  pre.textContent = `link_id=${linkId} を削除中...`;

  try {
    const response = await fetch(`${API_URL}/vtuber_links/${encodeURIComponent(linkId)}`, {
      method: 'DELETE'
    });

    if (response.status === 404) {
      pre.textContent = `link_id=${linkId} は見つかりませんでした。`;
      return;
    }

    if (!response.ok) {
      throw new Error(`削除に失敗しました: ${response.status}`);
    }

    const data = await response.json();
    pre.textContent = `削除しました: ${JSON.stringify(data.deleted, null, 2)}`;
    await loadLinkJson();
  } catch (error) {
    console.error(error);
    pre.textContent = `エラー: ${error.message}`;
  }
}

async function insertUserFavorite(event) {
  event.preventDefault();

  const message = document.getElementById('favoriteMessage');
  if (!message) return;

  const vtuberId = document.getElementById('favoriteVtuberId').value.trim();
  const token = sessionStorage.getItem('authToken');

  if (!token) {
    message.textContent = '推しを登録するには、先にユーザー登録してください。';
    return;
  }

  if (!vtuberId) {
    message.textContent = 'favorite vtuber_id を入力してください。';
    return;
  }

  message.textContent = '送信中...';

  try {
    const response = await fetch(`${API_URL}/favorites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        vtuber_id: Number(vtuberId)
      })
    });

    if (!response.ok) {
      const data = await response.json();
      if (response.status === 401) {
        sessionStorage.removeItem('authToken');
        message.textContent = '登録状態の有効期限が切れました。もう一度ユーザー登録してください。';
        return;
      }
      throw new Error(data.error || `登録に失敗しました: ${response.status}`);
    }

    message.textContent = '推しを登録しました。';
    document.getElementById('favoriteVtuberId').value = '';
    await loadMyPage();
  } catch (error) {
    console.error(error);
    message.textContent = `エラー: ${error.message}`;
  }
}
