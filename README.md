# りさだむ杯 ポータル

「りさだむ杯」の大会結果・個人成績ランキング・対戦成績を、スマートフォンのブラウザからいつでも見られるようにする静的サイト。

## 仕組み

- ビルド不要の素朴な静的サイト（HTML / CSS / 素のJavaScriptのみ）
- データは下記のGoogleスプレッドシートの **Info**（大会一覧）・**Team**（チーム名対応表）・**Result**（全試合の生データ）シートを、ページ表示のたびに [gviz API](https://developers.google.com/chart/interactive/docs/querylanguage) 経由で直接取得する
- 個人成績ランキング・対戦成績はサイト側（`js/data.js`）でResultシートから毎回計算している。スプレッドシート側の集計済みシート（通算個人成績・対戦成績）は表示専用の書式（▲記号など）が入っておりパースが面倒なため使っていない
- **スプレッドシートを更新すれば、サイト側は何もしなくても次に開いたときに自動で反映される**

対象スプレッドシート: `https://docs.google.com/spreadsheets/d/1-ZXP3SUqk4U8kK5XW_HJIxHbwJx2F9KVuTrVHrvYzv4/`
（共有設定が「リンクを知っている全員が閲覧可」になっている必要がある。設定を変えるとサイトが真っ白になるので注意）

## ファイル構成

```
index.html          エントリーポイント（ヘッダー・下部ナビ・スクリプト読み込み）
css/style.css        スタイル一式（モバイルファースト、ダークモード対応）
js/config.js          スプレッドシートID・シートgid・大会名・チーム色の設定（別大会への流用時はここを編集）
js/gviz.js            スプレッドシート取得レイヤー（JSONP方式、CORS制限を受けない）
js/data.js             データ正規化・集計ロジック（ランキング・対戦成績の計算はここ）
js/app.js              ハッシュルーティングと画面描画
```

## ページ構成

- `#/` … 大会一覧（歴代大会をカード表示、タップで詳細へ）
- `#/ranking` … 個人成績ランキング（総得点順、名前で検索可）
- `#/h2h` または `#/h2h/選手名` … 対戦成績（選手を選ぶと対戦相手ごとのポイント差を表示）
- `#/tournament/大会番号` … 大会詳細（対局結果を試合ごとに表示）

## ローカルでの確認方法

`index.html` を直接ダブルクリックしても動くが、念のため簡易サーバー経由を推奨。

```
python -m http.server 8000
```

その後ブラウザで `http://localhost:8000/` を開く。

## 公開（GitHub Pages）について

このフォルダ一式をGitHubリポジトリにpushし、リポジトリの Settings → Pages で
「Deploy from a branch」→ ブランチ `main` / フォルダ `/ (root)` を選ぶだけで公開できる
（ビルド工程が無いため、リポジトリのファイルがそのまま配信される）。

## 別の大会に流用する

このサイトは1つの大会シリーズ専用に作っているが、同じ形式のスプレッドシート運用であれば
以下を書き換えるだけで別の大会にも流用できる。

1. **`js/config.js`**
   - `SHEET_ID` / `GID` を新しい大会のスプレッドシートに差し替える
     （Info/Team/Resultの各タブを開いてURLの`gid=`を確認する）
   - `SITE_NAME` を新しい大会名に変更（ページ本文中の文言に使われる）
   - `TEAM_COLORS` を新しいチーム構成に合わせて変更・追加
     （未登録のチームコードは`DEFAULT_TEAM_COLOR`のグレーで表示される。
     CSSの編集は不要）
2. **`index.html`冒頭のコメントで示している3箇所**（`<title>` / `<meta name="description">` / `<h1>`）
   - SEO・リンクプレビュー用に静的HTMLとして直接書いているため、ここだけは
     `config.js`に一元化せず手動で編集する必要がある

上記以外（`js/app.js`・`js/data.js`・`css/style.css`）は編集不要のはず。
ただし運営スプレッドシートの列名がこのシリーズと異なる場合
（例: Result シートの列名が「素点」ではなく別名など）は、
`js/data.js`の`normalizeInfo`・`normalizeTeam`・`normalizeResults`内で
参照している列名を実際のシートに合わせて直す必要がある。

なお、GitHubの「Template repository」機能（Settings → General → Template repository）を
有効にしておくと、次回以降は「Use this template」ボタンから新しいリポジトリとして
このサイト一式をワンクリックで複製できる。
