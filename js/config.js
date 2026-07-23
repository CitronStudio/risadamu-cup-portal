// このサイトを別の大会に流用するときは、基本的にこのファイルだけ書き換えれば動くようにしてある。
// （タイトルやmeta descriptionなど、SEO・リンクプレビューに影響する部分だけはindex.html側の
//   静的HTMLに書く必要があるため対象外。index.html冒頭のコメントを参照）
const CONFIG = {
  // スプレッドシートの参照設定。シートIDやタブ構成が変わったらここだけ直せばよい。
  SHEET_ID: '1-ZXP3SUqk4U8kK5XW_HJIxHbwJx2F9KVuTrVHrvYzv4',
  GID: {
    info: 1781728076,   // 大会一覧
    team: 800741090,    // チーム名対応表（チーム管理タブ）
    result: 809066684,  // 全試合の生データ
  },

  // ページ本文中の文言に使う大会名（index.htmlのtitle/meta/h1は別途直接編集する）。
  SITE_NAME: 'りさだむ杯',

  // チームコードごとのバッジ色。運営スプレッドシートのセル色に合わせている。
  // 新しい大会でチーム構成が変わる場合は、ここに code: '#hex' を追加・変更するだけでよい
  // （CSS側の編集は不要）。未登録のコードはDEFAULT_TEAM_COLORが使われる。
  TEAM_COLORS: {
    DM: '#d2725f',
    RI: '#1f355d',
    YU: '#b19343',
    CI: '#517335',
    YS: '#905675',
    NO: '#6082e1',
  },
  DEFAULT_TEAM_COLOR: '#6b6b76',
};
