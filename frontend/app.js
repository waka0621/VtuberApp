const API_URL = 'http://localhost:5000/api';

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('showJson');
  if (btn) btn.addEventListener('click', loadTableJson);

  //削除するボタン
  const deletebtn = document.getElementById('deleteButton');
  if (deletebtn) deletebtn.addEventListener('click', deleteData);

  const form = document.getElementById('vtuberForm');
  if (form) form.addEventListener('submit', insertVtuber);

  loadTableJson();
});

async function insertVtuber(event) {
  event.preventDefault();

  const pre = document.getElementById('tableJson');
  if (!pre) return;

  // 各入力項目の値を取得
  const name = document.getElementById('vtuberName').value;
  const gender = document.getElementById('vtuberGender').value;
  const groupName = document.getElementById('vtuberGroupName').value;
  const birthday = document.getElementById('vtuberBirthday').value;
  const colorCode = document.getElementById('vtuberColorCode').value;
  const notes = document.getElementById('vtuberNotes').value;

  pre.textContent = '送信中...';
}

async function deleteData(event) {
  event.preventDefault();

  console.log("削除ボタンが押されました");

  // ここに削除処理を書く
}

const vtuber_id = 1;

  try {
    const response = await fetch(`${API_URL}/vtubers/${vtuber_id}`, {
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
  } catch (error) {
    console.error(error);
  }
}

    try {
    const response = await fetch(`${API_URL}/vtubers/${vtuber_id}`, {
      method: 'DELITE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    pre.textContent = JSON.stringify(data, null, 2);

    await loadTableJson();
  } catch (error) {
    pre.textContent = `エラー: ${error.message}`;
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