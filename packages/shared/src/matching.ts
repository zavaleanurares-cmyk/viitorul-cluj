import { norm, tokens } from "./text";

export type MatchablePlayer = {
  id: string;
  display_name: string;
  full_name: string;
  group_id: string | null;
};

export type RememberedMatch = { source_name: string; group_id: string | null; player_id: string };

export type MatchCandidate = {
  player_id: string;
  score: number;
  reason: "memorat" | "identic" | "nume conținut" | "parțial";
  same_group: boolean;
};

export type MatchProposal = {
  /** cheia sub care se ține minte potrivirea */
  key: string;
  candidates: MatchCandidate[];
  /** candidatul preselectat; preparatorul îl confirmă sau îl schimbă */
  suggested: string | null;
  /** potrivire sigură (memorată sau identică, fără concurent apropiat) */
  confident: boolean;
};

function tokenMatches(a: string, b: string): boolean {
  if (a === b) return true;
  // inițială: „P" ~ „POPTEAN"
  if (a.length === 1) return b.startsWith(a);
  if (b.length === 1) return a.startsWith(b);
  // prescurtare: „MOLDO" ~ „MOLDOVAN", „OCTA" ~ „OCTAVIAN"
  if (a.length >= 3 && b.startsWith(a)) return true;
  if (b.length >= 3 && a.startsWith(b)) return true;
  // o literă diferență la nume lungi: „PATRIK" ~ „PATRICK", „SFAIT" ~ „SFAT"
  if (Math.min(a.length, b.length) >= 4 && Math.abs(a.length - b.length) <= 1) return editDistanceAtMostOne(a, b);
  return false;
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a.length > b.length) [a, b] = [b, a];
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length === b.length) i++;
    j++;
  }
  return edits + (b.length - j) + (a.length - i) <= 1;
}

function coverage(src: string[], dst: string[]): number {
  if (!src.length) return 0;
  const used = new Set<number>();
  let hit = 0;
  for (const s of src) {
    const k = dst.findIndex((d, idx) => !used.has(idx) && tokenMatches(s, d));
    if (k >= 0) { used.add(k); hit++; }
  }
  return hit / src.length;
}

function scoreNames(source: string[], target: string[]): { score: number; reason: MatchCandidate["reason"] } {
  if (!source.length || !target.length) return { score: 0, reason: "parțial" };
  if (source.join(" ") === target.join(" ")) return { score: 0.95, reason: "identic" };
  if ([...source].sort().join(" ") === [...target].sort().join(" ")) return { score: 0.93, reason: "identic" };
  const a = coverage(source, target);
  const b = coverage(target, source);
  if (a === 1 || b === 1) {
    // toate cuvintele unui nume se regăsesc în celălalt; scorul scade când lipsesc multe cuvinte
    const ratio = Math.min(source.length, target.length) / Math.max(source.length, target.length);
    return { score: 0.7 + 0.15 * ratio, reason: "nume conținut" };
  }
  return { score: 0.55 * Math.max(a, b), reason: "parțial" };
}

/**
 * Propune potriviri între un nume dintr-un fișier și jucătorii din evidență.
 * Nu confirmă nimic singură: întoarce candidați, iar preparatorul decide.
 */
export function proposeMatch(
  sourceName: string,
  groupId: string | null,
  players: MatchablePlayer[],
  remembered: RememberedMatch[] = [],
): MatchProposal {
  const key = norm(sourceName);
  const src = tokens(sourceName);
  const candidates: MatchCandidate[] = [];

  const mem =
    remembered.find((m) => m.source_name === key && m.group_id === groupId) ??
    (groupId === null ? remembered.find((m) => m.source_name === key) : undefined);
  if (mem && players.some((p) => p.id === mem.player_id)) {
    const p = players.find((x) => x.id === mem.player_id)!;
    candidates.push({ player_id: mem.player_id, score: 1, reason: "memorat", same_group: p.group_id === groupId });
  }

  for (const p of players) {
    if (candidates.some((c) => c.player_id === p.id)) continue;
    const byDisplay = scoreNames(src, tokens(p.display_name));
    const byFull = scoreNames(src, tokens(p.full_name));
    const best = byDisplay.score >= byFull.score ? byDisplay : byFull;
    let score = best.score;
    const sameGroup = groupId !== null && p.group_id === groupId;
    if (groupId !== null) score += sameGroup ? 0.04 : -0.15;
    if (score >= 0.4) candidates.push({ player_id: p.id, score: Math.round(score * 100) / 100, reason: best.reason, same_group: sameGroup });
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, 6);
  const first = top[0];
  const second = top[1];
  const confident = !!first && first.score >= 0.9 && (!second || first.score - second.score >= 0.08);
  const suggested = first && first.score >= 0.6 && (!second || first.score - second.score >= 0.05) ? first.player_id : null;
  return { key, candidates: top, suggested, confident };
}
