"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Pencil, Plus, Send, Trash2, Undo2, X } from "lucide-react";
import { VIDEO_TAGS, formatClock, parseClock, parseMatchVideoUrl, type MatchVideoSource, type VideoTag } from "@club/shared";
import { Button, IconButton } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/messages";
import { deleteMarker, saveMarker, shareMarker } from "@/app/(app)/performanta/video/actions";

export type MarkerRow = { id: string; t_sec: number; end_sec: number | null; tag: VideoTag; label: string | null; shared: boolean; players: string[] };
type Video = { id: string; source: MatchVideoSource; url: string | null; fileUrl: string | null; title: string };
type Controller = { time: () => number | null; seek: (t: number) => void; toggle: () => void };

type YTPlayer = { getCurrentTime(): number; seekTo(t: number, allow: boolean): void; getPlayerState(): number; playVideo(): void; pauseVideo(): void };
declare global {
  interface Window { YT?: { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer }; onYouTubeIframeAPIReady?: () => void }
}

/** Încarcă o singură dată API-ul de redare YouTube (doar pe pagina de lucru, nu și la familie). */
function loadYouTube(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    if (!document.getElementById("yt-api")) {
      const s = document.createElement("script");
      s.id = "yt-api";
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  });
}

/**
 * Lucrul pe o înregistrare: redare (fișier încărcat sau YouTube, cu timpul curent), marcaje pe cronologie,
 * clipuri etichetate cu jucători și partajarea lor. VEO și alte surse se deschid separat; timpul se scrie de mână.
 */
export function VideoWorkspace({ video, markers, players, canEdit }: { video: Video; markers: MarkerRow[]; players: Array<{ id: string; name: string }>; canEdit: boolean }) {
  const t = useT().performance.video;
  const c = useT().common;
  const toast = useToast();
  const vRef = useRef<HTMLVideoElement>(null);
  const ytEl = useRef<HTMLDivElement>(null);
  const yt = useRef<YTPlayer | null>(null);
  const ytId = video.source === "youtube" && video.url ? parseMatchVideoUrl(video.url)?.id ?? null : null;
  const playable = video.source === "upload" || !!ytId;

  useEffect(() => {
    if (!ytId || !ytEl.current) return;
    let alive = true;
    loadYouTube().then(() => {
      if (!alive || !ytEl.current || !window.YT) return;
      yt.current = new window.YT.Player(ytEl.current, { videoId: ytId, host: "https://www.youtube-nocookie.com", playerVars: { rel: 0, modestbranding: 1 } });
    });
    return () => { alive = false; };
  }, [ytId]);

  const ctl: Controller = {
    time: () => (vRef.current ? vRef.current.currentTime : yt.current ? yt.current.getCurrentTime() : null),
    seek: (s) => { if (vRef.current) { vRef.current.currentTime = s; void vRef.current.play().catch(() => {}); } else yt.current?.seekTo(s, true); },
    toggle: () => {
      if (vRef.current) { if (vRef.current.paused) void vRef.current.play().catch(() => {}); else vRef.current.pause(); }
      else if (yt.current) { if (yt.current.getPlayerState() === 1) yt.current.pauseVideo(); else yt.current.playVideo(); }
    },
  };

  // formularul de marcaj
  const empty = { id: null as string | null, start: "", end: "", tag: "other" as VideoTag, label: "", players: [] as string[] };
  const [draft, setDraft] = useState(empty);
  const [formErr, setFormErr] = useState<string | null>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const save = useAction(saveMarker, { onSuccess: () => setDraft(empty) });
  const del = useAction(deleteMarker);
  const share = useAction(shareMarker, { successMessage: false, onSuccess: (r) => { if (r.notified) toast(t.marker.sharedToast(r.notified)); } });
  const nowText = () => { const s = ctl.time(); return s === null ? "" : formatClock(s); };

  // scurtături (în afara câmpurilor de text)
  useEffect(() => {
    if (!canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "m") { e.preventDefault(); setDraft((d) => ({ ...empty, tag: d.tag, start: nowText() })); setTimeout(() => labelRef.current?.focus(), 0); }
      else if (k === "e") { e.preventDefault(); setDraft((d) => ({ ...d, end: nowText() })); }
      else if (k === "j" || k === "l") { const s = ctl.time(); if (s !== null) { e.preventDefault(); ctl.seek(Math.max(0, s + (k === "j" ? -5 : 5))); } }
      else if (k === "k") { e.preventDefault(); ctl.toggle(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const submit = () => {
    const start = parseClock(draft.start);
    const end = draft.end ? parseClock(draft.end) : null;
    if (start === null || (draft.end && end === null)) { setFormErr(t.marker.badTime); return; }
    if (end !== null && end <= start) { setFormErr(t.marker.endBeforeStart); return; }
    setFormErr(null);
    save.run({ id: draft.id, videoId: video.id, t: start, end, tag: draft.tag, label: draft.label, playerIds: draft.players });
  };
  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const sourceName = t.sources[video.source];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        {video.source === "upload" && video.fileUrl ? (
                <video ref={vRef} src={video.fileUrl} controls preload="metadata" className="aspect-video w-full rounded-[var(--radius-card)] bg-black" />
        ) : ytId ? (
          <div className="aspect-video w-full overflow-hidden rounded-[var(--radius-card)] bg-black"><div ref={ytEl} className="size-full" /></div>
        ) : (
          <div className="space-y-3 rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 shadow-[var(--shadow-card)]">
            <p className="text-ink-2">{t.externalNote}</p>
            {video.url ? (
              <a href={video.url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-4 font-medium text-brand-ink">
                <ExternalLink className="size-5" aria-hidden />{t.openExternal(sourceName)}
              </a>
            ) : null}
          </div>
        )}
        {canEdit && playable ? <p className="text-sm text-ink-3">{t.shortcuts}</p> : null}

        {canEdit ? (
          <section className="space-y-3 rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 shadow-[var(--shadow-card)]" aria-label={draft.id ? t.marker.edit : t.marker.title}>
            <h2 className="text-lg">{draft.id ? t.marker.edit : t.marker.title}</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t.marker.start}>
                <div className="flex gap-1">
                  <Input value={draft.start} placeholder="12:04" inputMode="numeric" onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
                  {playable ? <Button variant="secondary" onClick={() => setDraft({ ...draft, start: nowText() })}>{t.marker.now}</Button> : null}
                </div>
              </Field>
              <Field label={t.marker.end} optional>
                <div className="flex gap-1">
                  <Input value={draft.end} placeholder="12:30" inputMode="numeric" onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
                  {playable ? <Button variant="secondary" onClick={() => setDraft({ ...draft, end: nowText() })}>{t.marker.now}</Button> : null}
                </div>
              </Field>
              <Field label={t.marker.tag}>
                <Select value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value as VideoTag })}>
                  {VIDEO_TAGS.map((x) => <option key={x} value={x}>{t.tags[x]}</option>)}
                </Select>
              </Field>
            </div>
            <Field label={t.marker.label} optional><Input ref={labelRef} value={draft.label} maxLength={200} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></Field>
            {players.length ? (
              <fieldset>
                <legend className="mb-1 text-sm font-semibold text-ink-2">{t.marker.players}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {players.map((p) => {
                    const on = draft.players.includes(p.id);
                    return (
                      <button key={p.id} type="button" aria-pressed={on} onClick={() => setDraft({ ...draft, players: on ? draft.players.filter((x) => x !== p.id) : [...draft.players, p.id] })}
                        className={on ? "inline-flex h-10 items-center gap-1 rounded-full bg-ink px-3 text-sm font-semibold text-surface" : "inline-flex h-10 items-center rounded-full border border-line-strong px-3 text-sm font-semibold hover:bg-canvas"}>
                        {on ? <Check className="size-4" aria-hidden /> : null}{p.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}
            <FormError>{formErr ?? save.error}</FormError>
            <div className="flex flex-wrap justify-end gap-2">
              {draft.id ? <Button variant="ghost" icon={<X className="size-5" aria-hidden />} onClick={() => setDraft(empty)}>{c.actions.cancel}</Button> : null}
              <Button icon={<Plus className="size-5" aria-hidden />} disabled={!draft.start.trim()} pending={save.pending} onClick={submit}>{t.marker.save}</Button>
            </div>
          </section>
        ) : null}
      </div>

      <section aria-label={t.markers(markers.length)} className="space-y-2">
        <h2 className="text-lg">{t.markers(markers.length)}</h2>
        <p className="text-sm text-ink-3">{t.marker.shareHint}</p>
        <ol className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]">
          {markers.map((m) => (
            <li key={m.id} className="space-y-1.5 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <button type="button" disabled={!playable} onClick={() => ctl.seek(m.t_sec)}
                  className="inline-flex h-9 shrink-0 items-center rounded-md bg-sunken px-2 font-semibold tabular-nums disabled:cursor-default">
                  {formatClock(m.t_sec)}{m.end_sec ? `–${formatClock(m.end_sec)}` : ""}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.tags[m.tag]}{m.label ? <span className="font-normal"> · {m.label}</span> : null}</span>
                  {m.players.length ? <span className="block text-sm text-ink-3">{m.players.map((p) => nameOf.get(p) ?? "—").join(", ")}</span> : null}
                </span>
                {m.shared ? <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-st-green-soft px-2.5 text-xs font-semibold"><Check className="size-3.5" aria-hidden />{t.marker.shared}</span> : null}
              </div>
              {canEdit ? (
                <div className="flex flex-wrap gap-1">
                  <IconButton label={t.marker.edit} onClick={() => setDraft({ id: m.id, start: formatClock(m.t_sec), end: m.end_sec ? formatClock(m.end_sec) : "", tag: m.tag, label: m.label ?? "", players: m.players })}><Pencil className="size-4" aria-hidden /></IconButton>
                  <IconButton label={t.marker.delete} onClick={() => del.run({ id: m.id, videoId: video.id })}><Trash2 className="size-4" aria-hidden /></IconButton>
                  {m.end_sec && m.players.length ? (
                    <Button size="sm" variant="secondary" pending={share.pending} icon={m.shared ? <Undo2 className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
                      onClick={() => share.run({ id: m.id, videoId: video.id, share: !m.shared })}>
                      {m.shared ? t.marker.unshare : t.marker.share}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
        <FormError>{del.error ?? share.error}</FormError>
      </section>
    </div>
  );
}
