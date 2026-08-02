// スプレッドシートから読み込んだ生データを、アプリで使いやすい形に正規化・集計するレイヤー。
// 個人成績ランキングと対戦成績は「Result」シート（全試合の生データ）から都度計算する。
// スプレッドシート側の集計済みシートは表示専用の書式（▲記号など）が入っているため使わない。

function round1(n) {
  return Math.round(n * 10) / 10;
}

function parseTournamentNo(infoRow) {
  if (infoRow['大会'] != null && infoRow['大会'] !== '') return Number(infoRow['大会']);
  const m = String(infoRow['大会名'] || '').match(/第(\d+)回/);
  return m ? Number(m[1]) : null;
}

function normalizeInfo(rawRows) {
  return rawRows
    .filter((r) => r['大会名'])
    .map((r) => ({
      no: parseTournamentNo(r),
      name: r['大会名'],
      dateText: r['日時'],
      championTeam: r['優勝チーム'],
      teamRanks: [r['#1'], r['#2'], r['#3'], r['#4']].filter(Boolean),
      individualChampion: r['個人優勝'],
      individualChampionTeam: r['個人優勝者のチーム'],
      participants: r['参加者'] != null ? Number(r['参加者']) : null,
      note: r['備考'] || '',
      tag: r['リンク'] || '',
    }))
    .filter((t) => t.no != null)
    .sort((a, b) => a.no - b.no);
}

function normalizeTeam(rawRows) {
  const map = new Map();
  for (const r of rawRows) {
    if (r['Tm']) map.set(r['Tm'], r['Name'] || r['Tm']);
  }
  return map;
}

// チョンボ回数を「大会番号 + チームコード」ごとに合計する。
// 減点はチーム得点にのみ効き、個人得点には影響しない（大会運営のルール）。
function normalizeDeductions(rawRows) {
  const map = new Map();
  for (const r of rawRows) {
    const tournamentNo = r['大会'] != null ? Number(r['大会']) : null;
    const teamCode = r['チーム'] || '';
    const chombo = r['チョンボ'] != null ? Number(r['チョンボ']) : 0;
    if (tournamentNo == null || Number.isNaN(tournamentNo) || !teamCode || !chombo) continue;
    const k = deductionKey(tournamentNo, teamCode);
    map.set(k, (map.get(k) || 0) + chombo);
  }
  return map;
}

function deductionKey(tournamentNo, teamCode) {
  return `${tournamentNo}:${teamCode}`;
}

function normalizeResults(rawRows) {
  return rawRows
    .filter((r) => r['名前'])
    .map((r) => ({
      matchNo: Number(r['試合番号']),
      id: r['ID'] != null ? Number(r['ID']) : null,
      name: String(r['名前']).trim(),
      soten: r['素点'] != null ? Number(r['素点']) : null,
      rank: r['順位'] != null ? Number(r['順位']) : null,
      point: r['ポイント'] != null ? Number(r['ポイント']) : 0,
      teamCode: r['チーム'] || '',
      tournamentNo: r['大会'] != null ? Number(r['大会']) : null,
    }))
    .filter((r) => r.tournamentNo != null && r.matchNo != null);
}

function computeCareerStats(results) {
  const byName = new Map();
  for (const r of results) {
    if (!byName.has(r.name)) {
      byName.set(r.name, {
        name: r.name,
        matches: 0,
        totalPoint: 0,
        maxPoint: -Infinity,
        minPoint: Infinity,
        maxSoten: -Infinity,
        rankCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
        tournaments: new Set(),
        teamsByTournament: new Map(),
        pointsByTournament: new Map(),
      });
    }
    const p = byName.get(r.name);
    p.matches += 1;
    p.totalPoint += r.point;
    if (r.point > p.maxPoint) p.maxPoint = r.point;
    if (r.point < p.minPoint) p.minPoint = r.point;
    if (r.soten != null && r.soten > p.maxSoten) p.maxSoten = r.soten;
    if (r.rank >= 1 && r.rank <= 4) p.rankCounts[r.rank] += 1;
    p.tournaments.add(r.tournamentNo);
    p.teamsByTournament.set(r.tournamentNo, r.teamCode);
    p.pointsByTournament.set(r.tournamentNo, (p.pointsByTournament.get(r.tournamentNo) || 0) + r.point);
  }

  const list = Array.from(byName.values()).map((p) => ({
    name: p.name,
    matches: p.matches,
    totalPoint: round1(p.totalPoint),
    avgPoint: p.matches ? round1(p.totalPoint / p.matches) : 0,
    maxPoint: round1(p.maxPoint),
    minPoint: round1(p.minPoint),
    maxSoten: p.maxSoten === -Infinity ? null : Math.round(p.maxSoten * 100),
    rankCounts: p.rankCounts,
    avgRank: p.matches
      ? (p.rankCounts[1] * 1 + p.rankCounts[2] * 2 + p.rankCounts[3] * 3 + p.rankCounts[4] * 4) / p.matches
      : 0,
    avoid4Rate: p.matches ? 1 - p.rankCounts[4] / p.matches : 0,
    tournamentsCount: p.tournaments.size,
    tournaments: Array.from(p.tournaments).sort((a, b) => a - b),
    teamsByTournament: p.teamsByTournament,
    pointsByTournament: p.pointsByTournament,
  }));

  list.sort((a, b) => b.totalPoint - a.totalPoint);
  list.forEach((p, i) => {
    p.rank = i + 1;
  });
  return list;
}

function computeHeadToHead(results) {
  const byMatch = new Map();
  for (const r of results) {
    if (!byMatch.has(r.matchNo)) byMatch.set(r.matchNo, []);
    byMatch.get(r.matchNo).push(r);
  }

  const h2h = new Map();
  const key = (a, b) => `${a} ${b}`;

  for (const players of byMatch.values()) {
    for (const a of players) {
      for (const b of players) {
        if (a.name === b.name) continue;
        const k = key(a.name, b.name);
        if (!h2h.has(k)) h2h.set(k, { games: 0, diffSum: 0 });
        const e = h2h.get(k);
        e.games += 1;
        e.diffSum += a.point - b.point;
      }
    }
  }
  return h2h;
}

function getOpponentRecords(h2h, allNames, playerName) {
  const out = [];
  for (const opp of allNames) {
    if (opp === playerName) continue;
    const e = h2h.get(`${playerName} ${opp}`);
    if (e) {
      out.push({
        opponent: opp,
        games: e.games,
        diffSum: round1(e.diffSum),
        avgDiff: round1(e.diffSum / e.games),
      });
    }
  }
  out.sort((a, b) => b.games - a.games || b.avgDiff - a.avgDiff);
  return out;
}

function groupMatchesByTournament(results) {
  const byTournament = new Map();
  for (const r of results) {
    if (!byTournament.has(r.tournamentNo)) byTournament.set(r.tournamentNo, new Map());
    const matches = byTournament.get(r.tournamentNo);
    if (!matches.has(r.matchNo)) matches.set(r.matchNo, []);
    matches.get(r.matchNo).push(r);
  }

  const out = new Map();
  for (const [tNo, matches] of byTournament) {
    const matchArr = Array.from(matches.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([matchNo, players]) => ({
        matchNo,
        players: players.slice().sort((a, b) => a.rank - b.rank),
      }));
    out.set(tNo, matchArr);
  }
  return out;
}

// 大会内の「チーム順位」「個人順位」を、運営スプレッドシートと同じ形式（合計/上位との差/着順回数）で集計する。
// 個人順位の試合列は、卓ごとに割り振られる大会内の物理的な試合番号ではなく、
// 各選手が「その日何試合目を打ったか」という個人ごとの通し番号（1,2,3...）で並べる。
function computeTournamentStandings(results, tournamentNo, deductions = new Map()) {
  const rows = results.filter((r) => r.tournamentNo === tournamentNo);

  const byPlayer = new Map();
  for (const r of rows) {
    if (!byPlayer.has(r.name)) {
      byPlayer.set(r.name, {
        name: r.name,
        teamCode: r.teamCode,
        total: 0,
        maxSoten: -Infinity,
        rankCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
        games: [],
      });
    }
    const p = byPlayer.get(r.name);
    p.total += r.point;
    if (r.soten != null && r.soten > p.maxSoten) p.maxSoten = r.soten;
    if (r.rank >= 1 && r.rank <= 4) p.rankCounts[r.rank] += 1;
    p.games.push({ matchNo: r.matchNo, point: r.point, rank: r.rank });
  }

  let maxGames = 0;
  const individualStandings = Array.from(byPlayer.values()).map((p) => {
    const orderedGames = p.games.slice().sort((a, b) => a.matchNo - b.matchNo);
    maxGames = Math.max(maxGames, orderedGames.length);
    const byMatch = new Map();
    orderedGames.forEach((g, i) => byMatch.set(i + 1, { point: g.point, rank: g.rank }));
    return {
      name: p.name,
      teamCode: p.teamCode,
      total: round1(p.total),
      maxSoten: p.maxSoten === -Infinity ? null : Math.round(p.maxSoten * 100),
      rankCounts: p.rankCounts,
      byMatch,
    };
  });
  const matchOrdinals = Array.from({ length: maxGames }, (_, i) => i + 1);
  individualStandings.sort((a, b) => b.total - a.total);
  individualStandings.forEach((p, i) => {
    p.rank = i + 1;
    p.diff = i === 0 ? null : round1(individualStandings[i - 1].total - p.total);
  });

  const byTeam = new Map();
  for (const r of rows) {
    if (!r.teamCode) continue;
    if (!byTeam.has(r.teamCode)) {
      byTeam.set(r.teamCode, { teamCode: r.teamCode, total: 0, rankCounts: { 1: 0, 2: 0, 3: 0, 4: 0 } });
    }
    const t = byTeam.get(r.teamCode);
    t.total += r.point;
    if (r.rank >= 1 && r.rank <= 4) t.rankCounts[r.rank] += 1;
  }
  // チョンボ分をチーム得点から引いてから順位づけする（減点で順位が入れ替わることがあるため）。
  const teamStandings = Array.from(byTeam.values()).map((t) => {
    const chombo = deductions.get(deductionKey(tournamentNo, t.teamCode)) || 0;
    return {
      ...t,
      chombo,
      total: round1(t.total - chombo * CONFIG.CHOMBO_PENALTY),
    };
  });
  teamStandings.sort((a, b) => b.total - a.total);
  teamStandings.forEach((t, i) => {
    t.rank = i + 1;
    t.diff = i === 0 ? null : round1(teamStandings[i - 1].total - t.total);
  });

  return { teamStandings, individualStandings, matchOrdinals };
}

async function loadAllData() {
  const [infoRaw, teamRaw, resultRaw, deductionRaw] = await Promise.all([
    loadSheetAsObjects(CONFIG.SHEET_ID, CONFIG.GID.info, ['日時']),
    loadSheetAsObjects(CONFIG.SHEET_ID, CONFIG.GID.team),
    loadSheetAsObjects(CONFIG.SHEET_ID, CONFIG.GID.result),
    // 減点シートはまだ用意されていない場合があるため、失敗しても全体を止めない。
    loadSheetAsObjects(CONFIG.SHEET_ID, { sheet: CONFIG.DEDUCTION_SHEET_NAME }).catch(() => []),
  ]);

  const tournaments = normalizeInfo(infoRaw);
  const teamNames = normalizeTeam(teamRaw);
  const results = normalizeResults(resultRaw);
  const deductions = normalizeDeductions(deductionRaw);
  const career = computeCareerStats(results);
  const h2h = computeHeadToHead(results);
  const matchesByTournament = groupMatchesByTournament(results);
  const allNames = career.map((p) => p.name).sort((a, b) => a.localeCompare(b, 'ja'));

  return {
    tournaments,
    teamNames,
    results,
    deductions,
    career,
    h2h,
    matchesByTournament,
    allNames,
  };
}
