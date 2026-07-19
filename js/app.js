// 画面描画とハッシュルーティングを担当する。フレームワークは使わず素朴なテンプレート文字列で組む。

const state = {
  data: null,
  loadError: null,
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
  return `<span class="badge badge-team badge-${escapeHtml(code)}" title="${escapeHtml(name)}">${escapeHtml(code)}</span>`;
}

function fmtSigned(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return '-';
  const s = v.toFixed(1);
  return v > 0 ? `+${s}` : s;
}

function fmtPercent(rate) {
  return `${Math.round(rate * 1000) / 10}%`;
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
          <span class="tournament-no">第${t.no}回</span>
          <span class="tournament-date">${escapeHtml(t.dateText || '')}</span>
        </div>
        <div class="tournament-title">${escapeHtml(t.name)}</div>
        <div class="tournament-meta">
          <span>優勝 ${teamBadge(champTeamCode, data.teamNames)} ${escapeHtml(data.teamNames.get(t.championTeam) || t.championTeam || '')}</span>
          <span>個人優勝 ${escapeHtml(t.individualChampion || '-')} ${teamBadge(t.individualChampionTeam, data.teamNames)}</span>
          <span>参加 ${t.participants != null ? t.participants + '人' : '-'}</span>
        </div>
      </a>`;
    })
    .join('');

  return `
    <section>
      <h1 class="page-title">大会一覧</h1>
      <p class="page-desc">りさだむ杯の歴代大会。タップすると各大会の対局結果を見られます。</p>
      <div class="card-list">${rows}</div>
    </section>`;
}

// ---------- ページ: 個人成績ランキング ----------
function renderRankingRow(p, tournamentNos, teamNames) {
  const perTournamentCells = tournamentNos
    .map((no) => {
      const pt = p.pointsByTournament.get(no);
      if (pt == null) {
        return `<td data-label="第${no}回" class="cell-tournament cell-muted">-</td>`;
      }
      const team = p.teamsByTournament.get(no);
      return `<td data-label="第${no}回" class="cell-tournament ${pt >= 0 ? 'positive' : 'negative'}">${fmtSigned(pt)} ${teamBadge(team, teamNames)}</td>`;
    })
    .join('');

  return `
    <tr>
      <td data-label="順位">${p.rank}</td>
      <td data-label="名前" class="cell-name">${escapeHtml(p.name)}</td>
      <td data-label="総得点" class="${p.totalPoint >= 0 ? 'positive' : 'negative'}">${fmtSigned(p.totalPoint)}</td>
      <td data-label="試合数">${p.matches}</td>
      <td data-label="平均">${fmtSigned(p.avgPoint)}</td>
      <td data-label="1着">${p.rankCounts[1]}</td>
      <td data-label="2着">${p.rankCounts[2]}</td>
      <td data-label="3着">${p.rankCounts[3]}</td>
      <td data-label="4着">${p.rankCounts[4]}</td>
      <td data-label="4着回避率">${fmtPercent(p.avoid4Rate)}</td>
      ${perTournamentCells}
    </tr>`;
}

function renderRanking(data, query = '') {
  const q = query.trim();
  const list = q
    ? data.career.filter((p) => p.name.includes(q))
    : data.career;

  const tournamentNos = data.tournaments.map((t) => t.no);
  const rowsHtml = list.map((p) => renderRankingRow(p, tournamentNos, data.teamNames)).join('');
  const tournamentHeaders = tournamentNos.map((no) => `<th>第${no}回</th>`).join('');

  return `
    <section>
      <h1 class="page-title">個人成績ランキング</h1>
      <p class="page-desc">全大会・全試合の合計ポイント順（りさだむ杯のRESULTシートより自動集計）。右へスクロールすると大会ごとの得点・所属チームも見られます。</p>
      <input
        id="ranking-search"
        class="search-box"
        type="search"
        placeholder="名前で検索"
        value="${escapeHtml(query)}"
        autocomplete="off"
      />
      <div class="table-wrap scroll-box">
        <table class="data-table ranking-table sticky-head">
          <thead>
            <tr>
              <th>順位</th><th>名前</th><th>総得点</th><th>試合数</th><th>平均</th>
              <th>1着</th><th>2着</th><th>3着</th><th>4着</th><th>4着回避率</th>
              ${tournamentHeaders}
            </tr>
          </thead>
          <tbody id="ranking-tbody">${rowsHtml}</tbody>
        </table>
        ${list.length === 0 ? '<p class="empty-msg">該当する選手が見つかりません。</p>' : ''}
      </div>
    </section>`;
}

// ---------- ページ: 対戦成績 ----------
function renderH2H(data, selectedName) {
  const options = data.allNames
    .map((n) => `<option value="${escapeHtml(n)}" ${n === selectedName ? 'selected' : ''}>${escapeHtml(n)}</option>`)
    .join('');

  let resultHtml = '<p class="page-desc">選手を選ぶと、同卓した相手ごとの通算ポイント差が分かります。</p>';
  if (selectedName) {
    const records = getOpponentRecords(data.h2h, data.allNames, selectedName);
    if (records.length === 0) {
      resultHtml = '<p class="empty-msg">この選手の対戦記録が見つかりません。</p>';
    } else {
      const rows = records
        .map(
          (r) => `
        <tr>
          <td data-label="相手" class="cell-name">${escapeHtml(r.opponent)}</td>
          <td data-label="同卓回数">${r.games}</td>
          <td data-label="通算ポイント差" class="${r.diffSum >= 0 ? 'positive' : 'negative'}">${fmtSigned(r.diffSum)}</td>
          <td data-label="平均ポイント差" class="${r.avgDiff >= 0 ? 'positive' : 'negative'}">${fmtSigned(r.avgDiff)}</td>
        </tr>`
        )
        .join('');
      resultHtml = `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>相手</th><th>同卓回数</th><th>通算ポイント差</th><th>平均ポイント差</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p class="hint-msg">※ポイント差はプラスなら${escapeHtml(selectedName)}が相手より多く獲得したことを表します。</p>`;
    }
  }

  return `
    <section>
      <h1 class="page-title">対戦成績</h1>
      <select id="h2h-select" class="search-box">
        <option value="">-- 選手を選択 --</option>
        ${options}
      </select>
      <div id="h2h-result">${resultHtml}</div>
    </section>`;
}

// ---------- ページ: 大会詳細 ----------
function renderTournamentDetail(data, no) {
  const t = data.tournaments.find((x) => x.no === no);
  if (!t) {
    return `<section><p class="empty-msg">大会が見つかりません。</p><a class="back-link" href="#/">← 大会一覧に戻る</a></section>`;
  }
  const matches = data.matchesByTournament.get(no) || [];

  const matchesHtml = matches
    .map(
      (m) => `
    <div class="card match-card">
      <div class="match-head">第${m.matchNo % 100}試合</div>
      <table class="data-table match-table">
        <thead><tr><th>順位</th><th>名前</th><th>チーム</th><th>素点</th><th>ポイント</th></tr></thead>
        <tbody>
          ${m.players
            .map(
              (p) => `
            <tr>
              <td data-label="順位">${p.rank}</td>
              <td data-label="名前" class="cell-name">${escapeHtml(p.name)}</td>
              <td data-label="チーム">${teamBadge(p.teamCode, data.teamNames)}</td>
              <td data-label="素点">${p.soten != null ? p.soten : '-'}</td>
              <td data-label="ポイント" class="${p.point >= 0 ? 'positive' : 'negative'}">${fmtSigned(p.point)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`
    )
    .join('');

  return `
    <section>
      <a class="back-link" href="#/">← 大会一覧に戻る</a>
      <h1 class="page-title">${escapeHtml(t.name)}</h1>
      <p class="page-desc">${escapeHtml(t.dateText || '')} ／ 参加 ${t.participants != null ? t.participants + '人' : '-'}</p>
      <div class="tournament-summary">
        <div>優勝チーム: ${teamBadge(t.teamRanks[0], data.teamNames)} ${escapeHtml(data.teamNames.get(t.championTeam) || t.championTeam || '')}</div>
        <div>チーム順位: ${t.teamRanks.map((c) => teamBadge(c, data.teamNames)).join(' ')}</div>
        <div>個人優勝: ${escapeHtml(t.individualChampion || '-')} ${teamBadge(t.individualChampionTeam, data.teamNames)}</div>
        ${t.note ? `<div>備考: ${escapeHtml(t.note)}</div>` : ''}
      </div>
      <h2 class="section-title">対局結果（全${matches.length}試合）</h2>
      <div class="card-list">${matchesHtml || '<p class="empty-msg">対局データがありません。</p>'}</div>
    </section>`;
}

// ---------- ルーティング ----------
function parseHash() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean);
  if (parts.length === 0) return { page: 'home' };
  if (parts[0] === 'ranking') return { page: 'ranking' };
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
    $app().innerHTML = renderRanking(state.data);
    document.getElementById('ranking-search').addEventListener('input', (e) => {
      const tournamentNos = state.data.tournaments.map((t) => t.no);
      document.getElementById('ranking-tbody').innerHTML = (
        e.target.value.trim()
          ? state.data.career.filter((p) => p.name.includes(e.target.value.trim()))
          : state.data.career
      )
        .map((p) => renderRankingRow(p, tournamentNos, state.data.teamNames))
        .join('');
    });
    document.getElementById('ranking-search').focus({ preventScroll: true });
  } else if (route.page === 'h2h') {
    $app().innerHTML = renderH2H(state.data, route.name);
    document.getElementById('h2h-select').addEventListener('change', (e) => {
      const name = e.target.value;
      location.hash = name ? `/h2h/${encodeURIComponent(name)}` : '/h2h';
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
