import { proposeMatch, tokens, type MatchProposal, type NameDecision } from "@club/shared";
import type { Decisions, ImportPlayer, NameItem } from "./types";

type Remembered = Array<{ source_name: string; group_id: string | null; player_id: string }>;

/** Propunerile de potrivire pentru toate numele din fișier (cheie: `NameItem.key`). */
export function proposeAll(names: NameItem[], players: ImportPlayer[], remembered: Remembered): Map<string, MatchProposal> {
  const out = new Map<string, MatchProposal>();
  for (const item of names) {
    // La datele fizice și la teste potrivirile se țin minte fără grupă; grupa aleasă în ecran
    // este doar un indiciu, așa că potrivirile memorate fără grupă trebuie găsite și cu ea.
    const memory =
      item.keyGroupId === null && item.hintGroupId !== null
        ? [...remembered.filter((m) => m.group_id === null).map((m) => ({ ...m, group_id: item.hintGroupId })), ...remembered]
        : remembered;
    out.set(item.key, proposeMatch(item.name, item.hintGroupId, players, memory));
  }
  return out;
}

/**
 * Decizia luată fără întrebare: potrivirile sigure (memorate sau identice), numele noi acolo unde
 * importul creează jucători și rândurile goale fără niciun candidat. Restul cer o decizie explicită.
 */
export function defaultDecision(item: NameItem, proposal: MatchProposal | undefined): NameDecision | undefined {
  const top = proposal?.candidates[0];
  if (proposal?.confident && top) return { action: "match", player_id: top.player_id };
  if (!proposal?.candidates.length) {
    if (item.autoCreate && item.allowCreate) return { action: "create" };
    if (!item.hasData) return { action: "skip" };
  }
  return undefined;
}

/** Deciziile efective: ale preparatorului, apoi cele implicite. Numele nerezolvate lipsesc. */
export function effectiveDecisions(names: NameItem[], proposals: Map<string, MatchProposal>, user: Decisions): Decisions {
  const out: Decisions = {};
  for (const item of names) {
    const d = user[item.key] ?? defaultDecision(item, proposals.get(item.key));
    if (d && (d.action !== "create" || item.allowCreate)) out[item.key] = d;
  }
  return out;
}

/** Nume diferite din fișier legate de același jucător: una dintre potriviri este greșită. */
export function findConflicts(names: NameItem[], decisions: Decisions): Array<{ player_id: string; names: string[] }> {
  const byPlayer = new Map<string, string[]>();
  for (const item of names) {
    const d = decisions[item.key];
    if (d?.action !== "match") continue;
    byPlayer.set(d.player_id, [...(byPlayer.get(d.player_id) ?? []), item.name]);
  }
  return [...byPlayer.entries()].filter(([, list]) => list.length > 1).map(([player_id, list]) => ({ player_id, names: list }));
}

/**
 * Propunere suficient de clară ca să poată fi confirmată în bloc: toate cuvintele numelui mai scurt
 * se regăsesc întocmai în celălalt (sau ca inițială: „P." ~ „POPTEAN"). Asemănările prin prescurtare
 * sau cu o literă diferență („POP" ~ „POPESCU") rămân de confirmat una câte una.
 */
export function isClearSuggestion(sourceName: string, player: ImportPlayer | undefined): boolean {
  if (!player) return false;
  const source = tokens(sourceName);
  return [player.display_name, player.full_name].some((target) => {
    const other = tokens(target);
    if (!source.length || !other.length) return false;
    const [short, long] = source.length <= other.length ? [source, other] : [other, source];
    const used = new Set<number>();
    return short.every((word) => {
      const k = long.findIndex((w, i) => !used.has(i) && (w === word || (word.length === 1 && w.startsWith(word)) || (w.length === 1 && word.startsWith(w))));
      if (k < 0) return false;
      used.add(k);
      return true;
    });
  });
}
