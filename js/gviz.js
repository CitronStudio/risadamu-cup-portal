// Googleスプレッドシートを、CORS制限を受けないJSONP方式（gviz API）で取得するレイヤー。
// fetch()だとGoogle側がAccess-Control-Allow-Originを返さずブロックされるため、
// <script>タグを動的に挿入しコールバック関数で結果を受け取る昔ながらの方式を使う。

let gvizCallbackSeq = 0;

function fetchGvizTable(sheetId, gid) {
  return new Promise((resolve, reject) => {
    const cbName = `__gviz_cb_${Date.now()}_${gvizCallbackSeq++}`;
    const script = document.createElement('script');

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('スプレッドシートの読み込みがタイムアウトしました'));
    }, 15000);

    function cleanup() {
      clearTimeout(timeoutId);
      delete window[cbName];
      script.remove();
    }

    window[cbName] = (resp) => {
      cleanup();
      if (!resp || resp.status === 'error') {
        const msg = (resp && resp.errors && resp.errors.map((e) => e.detailed_message).join(' / ')) || '不明なエラー';
        reject(new Error(`スプレッドシートの取得に失敗しました: ${msg}`));
        return;
      }
      resolve(resp.table);
    };

    const url =
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
      `?tqx=out:json;responseHandler:${cbName}&gid=${gid}`;
    script.src = url;
    script.onerror = () => {
      cleanup();
      reject(new Error('スプレッドシートの読み込みに失敗しました（ネットワークエラー）'));
    };
    document.head.appendChild(script);
  });
}

// gvizのtable構造を、ラベルをキーにした素直なオブジェクト配列に変換する。
// セルは { v: 生の値, f: 表示用にフォーマットされた文字列 } の形。
// 日付列はダブルクリック等で使いやすいよう v(Date(y,m,d)形式の文字列) と f(表示文字列) の両方を保持する。
function gvizTableToRows(table) {
  const labels = table.cols.map((c, i) => c.label || c.id || `col${i}`);
  return table.rows.map((row) => {
    const obj = {};
    labels.forEach((label, i) => {
      const cell = row.c && row.c[i];
      obj[label] = {
        v: cell ? cell.v : null,
        f: cell && cell.f != null ? cell.f : (cell ? cell.v : null),
      };
    });
    return obj;
  });
}

// 値だけを取り出した扱いやすい形（{列名: 値}）にする。数値・文字列はvを、日付表示はfを優先。
function simplifyRows(rows, dateFields = []) {
  return rows.map((row) => {
    const out = {};
    for (const key in row) {
      out[key] = dateFields.includes(key) ? row[key].f : row[key].v;
    }
    return out;
  });
}

async function loadSheetAsObjects(sheetId, gid, dateFields = []) {
  const table = await fetchGvizTable(sheetId, gid);
  const rows = gvizTableToRows(table);
  return simplifyRows(rows, dateFields);
}
