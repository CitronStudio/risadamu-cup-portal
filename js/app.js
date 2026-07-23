// 画面描画とハッシュルーティングを担当する。フレームワークは使わず素朴なテンプレート文字列で組む。

const state = {
  data: null,
  loadError: null,
  h2hSort: { key: 'games', dir: 'desc' },
  rankingSort: { key: 'totalPoint', dir: 'desc' },
};

const $app = () => document.getElementById('app');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function teamBadge(code, teamNames) {
  if (!code) return '';
  const name = teamNames.get(code) || code;
  const color = CONFIG.TEAM_COLORS[code] || CONFIG.DEFAULT_TEAM_COLOR;
  return `<span class="badge badge-team" style="background:${color}" title="${escapeHtml(name)}">${escapeHtml(code)}</span>`;
}

function fmtSigned(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return '-';
  const s = v.toFixed(1);
  return v > 0 ? `+${s}` : s;
}

function fmtPercent(rate) {
  return `${(rate * 100).toFixed(1)}%`;
}

function fmtNumber(n) {
  if (n == null || Number.isNaN(Number(n))) return '-';
  return String(Number(n));
}

const CIRCLED_RANK = ['', '①', '②', '③', '④'];

// 運営スプレッドシートと同じ表記（プラスは青、マイナスは▲付き赤）で得点を表示する。
function fmtSheetPoint(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return '-';
  return v >= 0
    ? `<span class="sheet-pos">${v.toFixed(1)}</span>`
    : `<span class="sheet-neg">▲${Math.abs(v).toFixed(1)}</span>`;
}

function fmtDiff(n) {
  if (n == null) return '-';
  return Number(n).toFixed(1);
}

// ---------- ページ: 大会一覧 ----------
function renderTournamentList(data) {
  const rows = data.tournaments
    .slice()
    .sort((a, b) => b.no - a.no)
    .map((t) => {
      const champTeamCode = t.teamRanks[0] || '';
      return `
      <a class="card tournament-card" href="#/tournament/${t.no}">
        <div class="tournament-card-head">
          <span class="tournament-title">${escapeHtml(t.name)}</span>
          <span class="tournament-date">${escapeHtml(t.dateText || '')}</span>
        </div>
        <div class="tournament-meta">
          <span>優勝 ${teamBadge(champTeamCode, data.teamNames)} <span class="meta-strong">${escapeHtml(data.teamNames.get(t.championTeam) || t.championTeam || '')}</span></span>
          <span>チーム順位 ${t.teamRanks.map((c) => teamBadge(c, data.teamNames)).join(' ')}</span>
          <span>個人優勝 <span class="meta-strong">${escapeHtml(t.individualChampion || '-')}</span> ${teamBadge(t.individualChampionTeam, data.teamNames)}</span>
          <span>参加 ${t.participants != null ? t.participants + '人' : '-'}</span>
        </div>
      </a>`;
    })
    .join('');

  return `
    <section>
      <h1 class="page-title">大会一覧</h1>
      <p class="page-desc">${escapeHtml(CONFIG.SITE_NAME)}の歴代大会。タップすると各大会の対局結果を見られます。</p>
      <div class="card-list">${rows}</div>
    </section>`;
}

// ---------- ページ: 個人成績ランキング ----------
const RANKING_SORT_COLUMNS = [
  { key: 'rank', label: '順位', defaultDir: 'asc', get: (p) => p.rank, headClass: 'col-rank' },
  { key: 'name', label: '名前', defaultDir: 'asc', get: (p) => p.name, isString: true, headClass: 'col-name' },
  { key: 'totalPoint', label: '総得点', defaultDir: 'desc', get: (p) => p.totalPoint },
  { key: 'matches', label: '試合数', defaultDir: 'desc', get: (p) => p.matches },
  { key: 'rank1', label: '1着', defaultDir: 'desc', get: (p) => p.rankCounts[1] },
  { key: 'rank2', label: '2着', defaultDir: 'desc', get: (p) => p.rankCounts[2] },
  { key: 'rank3', label: '3着', defaultDir: 'desc', get: (p) => p.rankCounts[3] },
  { key: 'rank4', label: '4着', defaultDir: 'desc', get: (p) => p.rankCounts[4] },
  { key: 'avoid4Rate', label: '4着回避率', defaultDir: 'desc', get: (p) => p.avoid4Rate },
  { key: 'maxSoten', label: '最高得点', defaultDir: 'desc', get: (p) => p.maxSoten },
];

function sortRankingList(list, sort) {
  const col = RANKING_SORT_COLUMNS.find((c) => c.key === sort.key);
  if (!col) return list;
  const sorted = list.slice().sort((a, b) => {
    const va = col.get(a);
    const vb = col.get(b);
    const cmp = col.isString ? String(va).localeCompare(String(vb), 'ja') : (va ?? -Infinity) - (vb ?? -Infinity);
    return sort.dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

function renderRankingRow(p, tournamentNos, teamNames) {
  const perTournamentCells = tournamentNos
    .map((no) => {
      const pt = p.pointsByTournament.get(no);
      if (pt == null) {
        return `<td data-label="第${no}回" class="cell-tournament cell-muted">-</td>`;
      }
      const team = p.teamsByTournament.get(no);
      return `<td data-label="第${no}回" class="cell-tournament ${pt >= 0 ? 'sheet-pos' : 'sheet-neg'}">${fmtSigned(pt)} ${teamBadge(team, teamNames)}</td>`;
    })
    .join('');

  return `
    <tr>
      <td data-label="順位" class="col-rank">${p.rank}</td>
      <td data-label="名前" class="cell-name col-name">${escapeHtml(p.name)}</td>
      <td data-label="総得点" class="cell-total ${p.totalPoint >= 0 ? 'sheet-pos' : 'sheet-neg'}">${fmtSigned(p.totalPoint)}</td>
      <td data-label="試合数" class="cell-matches">${p.matches}</td>
      <td data-label="1着">${p.rankCounts[1]}</td>
      <td data-label="2着">${p.rankCounts[2]}</td>
      <td data-label="3着">${p.rankCounts[3]}</td>
      <td data-label="4着">${p.rankCounts[4]}</td>
      <td data-label="4着回避率">${fmtPercent(p.avoid4Rate)}</td>
      <td data-label="最高得点">${fmtNumber(p.maxSoten)}</td>
      ${perTournamentCells}
    </tr>`;
}

function renderRankingHeader() {
  return RANKING_SORT_COLUMNS.map((col) => {
    const active = state.rankingSort.key === col.key;
    const arrow = active ? (state.rankingSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    const classes = ['sortable-th', col.headClass, active ? 'active' : ''].filter(Boolean).join(' ');
    return `<th class="${classes}" data-sort="${col.key}">${col.label}${arrow}</th>`;
  }).join('');
}

function renderRankingBody(data, query) {
  const q = query.trim();
  const filtered = q ? data.career.filter((p) => p.name.includes(q)) : data.career;
  const list = sortRankingList(filtered, state.rankingSort);
  const tournamentNos = data.tournaments.map((t) => t.no);
  const rowsHtml = list.map((p) => renderRankingRow(p, tournamentNos, data.teamNames)).join('');
  return { rowsHtml, isEmpty: list.length === 0 };
}

function renderRanking(data, query = '') {
  const tournamentNos = data.tournaments.map((t) => t.no);
  const tournamentHeaders = tournamentNos.map((no) => `<th>第${no}回</th>`).join('');
  const { rowsHtml, isEmpty } = renderRankingBody(data, query);

  return `
    <section>
      <h1 class="page-title">個人成績ランキング</h1>
      <p class="page-desc">全大会・全試合の合計ポイント順（${escapeHtml(CONFIG.SITE_NAME)}のRESULTシートより自動集計）。列名タップで並び替え、右へスクロールすると大会ごとの得点・所属チームも見られます。</p>
      <input
        id="ranking-search"
        class="search-box"
        type="search"
        placeholder="名前で検索"
        value="${escapeHtml(query)}"
        autocomplete="off"
      />
      <div class="table-wrap scroll-box">
        <table class="data-table ranking-table keep-table sticky-head">
          <thead>
            <tr id="ranking-thead-row">
              ${renderRankingHeader()}
              ${tournamentHeaders}
            </tr>
          </thead>
          <tbody id="ranking-tbody">${rowsHtml}</tbody>
        </table>
        <p id="ranking-empty-msg" class="empty-msg" ${isEmpty ? '' : 'hidden'}>該当する選手が見つかりません。</p>
      </div>
    </section>`;
}

// ---------- ページ: 開催中 ----------
function renderLive() {
  return `
    <section class="live-box">
      <p>現在大会は開催されていません</p>
    </section>`;
}

// ---------- ページ: 対戦成績 ----------
const H2H_SORT_COLUMNS = [
  { key: 'opponent', label: '相手', defaultDir: 'asc' },
  { key: 'games', label: '同卓回数', defaultDir: 'desc' },
  { key: 'diffSum', label: '通算ポイント差', defaultDir: 'desc' },
  { key: 'avgDiff', label: '平均ポイント差', defaultDir: 'desc' },
];

function sortH2HRecords(records, sort) {
  const sorted = records.slice().sort((a, b) => {
    const cmp =
      sort.key === 'opponent' ? a.opponent.localeCompare(b.opponent, 'ja') : a[sort.key] - b[sort.key];
    return sort.dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

function renderH2HResult(data, selectedName) {
  if (!selectedName) {
    return '<p class="page-desc">選手を選ぶと、同卓した相手ごとの通算ポイント差が分かります。</p>';
  }
  const records = getOpponentRecords(data.h2h, data.allNames, selectedName);
  if (records.length === 0) {
    return '<p class="empty-msg">この選手の対戦記録が見つかりません。</p>';
  }

  const sorted = sortH2HRecords(records, state.h2hSort);
  const headers = H2H_SORT_COLUMNS.map(({ key, label }) => {
    const active = state.h2hSort.key === key;
    const arrow = active ? (state.h2hSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th data-sort="${key}" class="sortable-th${active ? ' active' : ''}">${label}${arrow}</th>`;
  }).join('');

  const rows = sorted
    .map(
      (r) => `
        <tr>
          <td data-label="相手" class="cell-name">${escapeHtml(r.opponent)}</td>
          <td data-label="同卓回数">${r.games}</td>
          <td data-label="通算ポイント差" class="${r.diffSum >= 0 ? 'sheet-pos' : 'sheet-neg'}">${fmtSigned(r.diffSum)}</td>
          <td data-label="平均ポイント差" class="${r.avgDiff >= 0 ? 'sheet-pos' : 'sheet-neg'}">${fmtSigned(r.avgDiff)}</td>
        </tr>`
    )
    .join('');

  return `
    <div class="table-wrap">
      <table class="data-table h2h-table keep-table">
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="hint-msg">※ポイント差はプラスなら${escapeHtml(selectedName)}が相手より多く獲得したことを表します。列名タップで並び替えできます。</p>`;
}

function renderH2H(data, selectedName) {
  const options = data.allNames
    .map((n) => `<option value="${escapeHtml(n)}" ${n === selectedName ? 'selected' : ''}>${escapeHtml(n)}</option>`)
    .join('');

  return `
    <section>
      <h1 class="page-title">対戦成績</h1>
      <select id="h2h-select" class="search-box">
        <option value="">-- 選手を選択 --</option>
        ${options}
      </select>
      <div id="h2h-result">${renderH2HResult(data, selectedName)}</div>
    </section>`;
}

// ---------- 大会詳細: チーム順位 ----------
function renderTeamStandings(teamStandings, teamNames) {
  const rows = teamStandings
    .map(
      (t) => `
    <tr>
      <td data-label="順位" class="col-rank">${t.rank}</td>
      <td data-label="チーム" class="cell-name">${teamBadge(t.teamCode, teamNames)} <span class="meta-strong">${escapeHtml(teamNames.get(t.teamCode) || t.teamCode)}</span></td>
      <td data-label="合計" class="cell-total">${fmtSheetPoint(t.total)}</td>
      <td data-label="差" class="cell-diff">${fmtDiff(t.diff)}</td>
      <td data-label="1着">${t.rankCounts[1]}</td>
      <td data-label="2着">${t.rankCounts[2]}</td>
      <td data-label="3着">${t.rankCounts[3]}</td>
      <td data-label="4着">${t.rankCounts[4]}</td>
    </tr>`
    )
    .join('');

  return `
    <div class="table-wrap">
      <table class="data-table standings-table keep-table">
        <thead>
          <tr>
            <th class="col-rank">順位</th><th>チーム</th><th>合計</th><th>差</th>
            <th>1着</th><th>2着</th><th>3着</th><th>4着</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ---------- 大会詳細: 個人順位 ----------
function renderIndividualStandings(individualStandings, matchOrdinals, teamNames) {
  const matchHeaders = matchOrdinals.map((no) => `<th>${no}</th>`).join('');

  const rows = individualStandings
    .map((p) => {
      const matchCells = matchOrdinals
        .map((no) => {
          const m = p.byMatch.get(no);
          if (!m) return `<td data-label="${no}試合目" class="cell-tournament cell-muted">-</td>`;
          const circle = CIRCLED_RANK[m.rank] || '';
          return `<td data-label="${no}試合目" class="cell-tournament">${fmtSheetPoint(m.point)} <span class="rank-circle">${circle}</span></td>`;
        })
        .join('');

      return `
    <tr>
      <td data-label="順位" class="col-rank">${p.rank}</td>
      <td data-label="名前" class="cell-name col-name">${escapeHtml(p.name)}</td>
      <td data-label="チーム">${teamBadge(p.teamCode, teamNames)}</td>
      <td data-label="総得点" class="cell-total">${fmtSheetPoint(p.total)}</td>
      <td data-label="差" class="cell-diff">${fmtDiff(p.diff)}</td>
      ${matchCells}
      <td data-label="1着">${p.rankCounts[1]}</td>
      <td data-label="2着">${p.rankCounts[2]}</td>
      <td data-label="3着">${p.rankCounts[3]}</td>
      <td data-label="4着">${p.rankCounts[4]}</td>
      <td data-label="最大点">${fmtNumber(p.maxSoten)}</td>
    </tr>`;
    })
    .join('');

  return `
    <div class="table-wrap scroll-box">
      <table class="data-table standings-table keep-table sticky-head">
        <thead>
          <tr>
            <th class="col-rank">順位</th><th class="col-name">名前</th><th>チーム</th><th>総得点</th><th>差</th>
            ${matchHeaders}
            <th>1着</th><th>2着</th><th>3着</th><th>4着</th><th>最大点</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ---------- ページ: 大会詳細 ----------
function renderTournamentDetail(data, no) {
  const t = data.tournaments.find((x) => x.no === no);
  if (!t) {
    return `<section><p class="empty-msg">大会が見つかりません。</p><a class="back-link" href="#/">← 大会一覧に戻る</a></section>`;
  }
  const matches = data.matchesByTournament.get(no) || [];
  const { teamStandings, individualStandings, matchOrdinals } = computeTournamentStandings(data.results, no);

  const matchesHtml = matches
    .map((m) => {
      const rankHeaders = m.players.map((p) => `<th>${p.rank}位</th>`).join('');
      const nameCells = m.players.map((p) => `<td class="cell-name">${escapeHtml(p.name)}</td>`).join('');
      const teamCells = m.players.map((p) => `<td>${teamBadge(p.teamCode, data.teamNames)}</td>`).join('');
      const sotenCells = m.players
        .map((p) => `<td>${p.soten != null ? fmtNumber(p.soten * 100) : '-'}</td>`)
        .join('');
      const pointCells = m.players.map((p) => `<td>${fmtSheetPoint(p.point)}</td>`).join('');

      return `
    <div class="card match-card">
      <div class="match-head">第${m.matchNo % 100}試合</div>
      <div class="table-wrap">
        <table class="data-table match-table keep-table">
          <colgroup>
            <col class="match-col-label"><col class="match-col-rank"><col class="match-col-rank"><col class="match-col-rank"><col class="match-col-rank">
          </colgroup>
          <thead>
            <tr><th></th>${rankHeaders}</tr>
          </thead>
          <tbody>
            <tr><th>名前</th>${nameCells}</tr>
            <tr><th>チーム</th>${teamCells}</tr>
            <tr><th>素点</th>${sotenCells}</tr>
            <tr><th>Pt</th>${pointCells}</tr>
          </tbody>
        </table>
      </div>
    </div>`;
    })
    .join('');

  return `
    <section>
      <a class="back-link" href="#/">← 大会一覧に戻る</a>
      <h1 class="page-title">${escapeHtml(t.name)}</h1>
      <p class="page-desc">${escapeHtml(t.dateText || '')} ／ 参加 ${t.participants != null ? t.participants + '人' : '-'}</p>
      <div class="tournament-summary">
        <div>優勝チーム: ${teamBadge(t.teamRanks[0], data.teamNames)} ${escapeHtml(data.teamNames.get(t.championTeam) || t.championTeam || '')}</div>
        <div>個人優勝: ${escapeHtml(t.individualChampion || '-')} ${teamBadge(t.individualChampionTeam, data.teamNames)}</div>
        ${t.note ? `<div>備考: ${escapeHtml(t.note)}</div>` : ''}
      </div>

      <h2 class="section-title">チーム順位</h2>
      ${teamStandings.length ? renderTeamStandings(teamStandings, data.teamNames) : '<p class="empty-msg">データがありません。</p>'}

      <h2 class="section-title">個人順位</h2>
      ${individualStandings.length ? renderIndividualStandings(individualStandings, matchOrdinals, data.teamNames) : '<p class="empty-msg">データがありません。</p>'}

      <h2 class="section-title">各卓の詳細（全${matches.length}試合）</h2>
      <div class="card-list">${matchesHtml || '<p class="empty-msg">対局データがありません。</p>'}</div>
    </section>`;
}

// ---------- ルーティング ----------
function parseHash() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean);
  if (parts.length === 0) return { page: 'home' };
  if (parts[0] === 'ranking') return { page: 'ranking' };
  if (parts[0] === 'live') return { page: 'live' };
  if (parts[0] === 'h2h') return { page: 'h2h', name: parts[1] ? decodeURIComponent(parts[1]) : '' };
  if (parts[0] === 'tournament') return { page: 'tournament', no: Number(parts[1]) };
  return { page: 'home' };
}

function setActiveNav(page) {
  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.page === page);
  });
}

function render() {
  if (state.loadError) {
    $app().innerHTML = `
      <section class="error-box">
        <p>データの読み込みに失敗しました。</p>
        <p class="error-detail">${escapeHtml(state.loadError.message || String(state.loadError))}</p>
        <button id="retry-btn" class="retry-btn">再読み込み</button>
      </section>`;
    document.getElementById('retry-btn').addEventListener('click', () => {
      location.reload();
    });
    return;
  }

  if (!state.data) {
    $app().innerHTML = `<section class="loading-box"><div class="spinner"></div><p>スプレッドシートを読み込み中...</p></section>`;
    return;
  }

  const route = parseHash();
  setActiveNav(route.page === 'tournament' ? 'home' : route.page);

  if (route.page === 'ranking') {
    state.rankingSort = { key: 'totalPoint', dir: 'desc' };
    $app().innerHTML = renderRanking(state.data);
    const updateRankingBody = () => {
      const { rowsHtml, isEmpty } = renderRankingBody(state.data, document.getElementById('ranking-search').value);
      document.getElementById('ranking-tbody').innerHTML = rowsHtml;
      document.getElementById('ranking-empty-msg').hidden = !isEmpty;
    };
    document.getElementById('ranking-search').addEventListener('input', updateRankingBody);
    document.getElementById('ranking-thead-row').addEventListener('click', (e) => {
      const th = e.target.closest('th[data-sort]');
      if (!th) return;
      const key = th.dataset.sort;
      if (state.rankingSort.key === key) {
        state.rankingSort.dir = state.rankingSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        const col = RANKING_SORT_COLUMNS.find((c) => c.key === key);
        state.rankingSort = { key, dir: col.defaultDir };
      }
      document.getElementById('ranking-thead-row').innerHTML =
        renderRankingHeader() + state.data.tournaments.map((t) => `<th>第${t.no}回</th>`).join('');
      updateRankingBody();
    });
    document.getElementById('ranking-search').focus({ preventScroll: true });
  } else if (route.page === 'live') {
    $app().innerHTML = renderLive();
  } else if (route.page === 'h2h') {
    state.h2hSort = { key: 'games', dir: 'desc' };
    $app().innerHTML = renderH2H(state.data, route.name);
    document.getElementById('h2h-select').addEventListener('change', (e) => {
      const name = e.target.value;
      location.hash = name ? `/h2h/${encodeURIComponent(name)}` : '/h2h';
    });
    document.getElementById('h2h-result').addEventListener('click', (e) => {
      const th = e.target.closest('th[data-sort]');
      if (!th) return;
      const key = th.dataset.sort;
      if (state.h2hSort.key === key) {
        state.h2hSort.dir = state.h2hSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        const col = H2H_SORT_COLUMNS.find((c) => c.key === key);
        state.h2hSort = { key, dir: col.defaultDir };
      }
      document.getElementById('h2h-result').innerHTML = renderH2HResult(state.data, route.name);
    });
  } else if (route.page === 'tournament') {
    $app().innerHTML = renderTournamentDetail(state.data, route.no);
  } else {
    $app().innerHTML = renderTournamentList(state.data);
  }

  window.scrollTo(0, 0);
}

async function init() {
  window.addEventListener('hashchange', render);
  render();
  try {
    state.data = await loadAllData();
  } catch (err) {
    state.loadError = err;
  }
  render();
}

init();
