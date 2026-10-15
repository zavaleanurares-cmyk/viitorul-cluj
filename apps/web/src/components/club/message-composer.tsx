"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Save, Send, Users } from "lucide-react";
import { ROLE_LABELS, type AppRole } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { previewAudience, saveTemplate, sendMessage } from "@/app/(app)/club/mesaje/actions";

type Audience = "guardians" | "players" | "coaches" | "staff";
type Recipient = { user_id: string; full_name: string; role: string; reason: string };
type Template = { key: string; name: string; title: string; body: string };

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" aria-pressed={on} onClick={onClick}
    className={on ? "inline-flex h-11 items-center gap-1 rounded-full bg-ink px-4 font-semibold text-surface" : "inline-flex h-11 items-center rounded-full border border-line-strong px-4 font-semibold hover:bg-canvas"}>
    {on ? <Check className="size-4" aria-hidden /> : null}{children}
  </button>
);

/**
 * Compunerea unui mesaj: cui (public + echipe), ce, când. Trimiterea cere întâi lista destinatarilor
 * (regula „mesajele în masă arată mereu lista înainte"), din care se pot scoate persoane.
 */
export function MessageComposer({ teams, templates, coach, staffAllowed, canSaveTemplates }: {
  teams: Array<{ id: string; name: string }>; templates: Template[]; coach: boolean; staffAllowed: boolean; canSaveTemplates: boolean;
}) {
  const t = useT().club.messages;
  const toast = useToast();
  const router = useRouter();
  const [audiences, setAudiences] = useState<Audience[]>(["guardians"]);
  const [groups, setGroups] = useState<string[]>(coach && teams.length === 1 ? [teams[0].id] : []);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [later, setLater] = useState(false);
  const [at, setAt] = useState("");
  const [list, setList] = useState<Recipient[] | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [tplName, setTplName] = useState("");
  const audience = useMemo(() => ({ audiences, group_ids: groups, exclude_user_ids: excluded }), [audiences, groups, excluded]);
  const preview = useAction(previewAudience, { successMessage: false, refresh: false, onSuccess: (r) => { setList(r); setExcluded([]); } });
  const send = useAction(sendMessage, {
    successMessage: false,
    onSuccess: (r) => { toast(later ? t.scheduled : t.sent(r.recipients)); router.push("/club/mesaje"); },
  });
  const tpl = useAction(saveTemplate, { onSuccess: () => setTplName("") });
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const reset = () => setList(null);
  const count = list ? list.length - excluded.length : 0;
  const scheduledIso = later && at ? new Date(at).toISOString() : null;
  const ready = title.trim().length >= 2 && body.trim().length > 0 && list && count > 0 && (!later || !!scheduledIso) && (!coach || groups.length > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <section className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <h2 className="text-lg">{t.to}</h2>
          <div className="flex flex-wrap gap-2">
            {(["guardians", "players", "coaches", ...(staffAllowed ? ["staff"] : [])] as Audience[]).map((a) => (
              <Chip key={a} on={audiences.includes(a)} onClick={() => { setAudiences(toggle(audiences, a)); reset(); }}>{t.audiences[a]}</Chip>
            ))}
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-ink-2">{t.teams}</legend>
            <div className="flex flex-wrap gap-2">
              {teams.map((g) => <Chip key={g.id} on={groups.includes(g.id)} onClick={() => { setGroups(toggle(groups, g.id)); reset(); }}>{g.name}</Chip>)}
            </div>
            <p className="mt-1 text-sm text-ink-3">{coach ? t.coachTeamsHint : t.allTeamsHint}</p>
          </fieldset>
        </section>

        <section className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          {templates.length ? (
            <Field label={t.template}>
              <Select defaultValue="" onChange={(e) => { const x = templates.find((k) => k.key === e.target.value); if (x) { setTitle(x.title); setBody(x.body); } }}>
                <option value="">{t.noTemplate}</option>
                {templates.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
              </Select>
            </Field>
          ) : null}
          <Field label={t.subject}><Input value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label={t.body}><Textarea rows={8} value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} /></Field>
          {canSaveTemplates && title.trim() && body.trim() ? (
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t.templateName} className="min-w-48 flex-1"><Input value={tplName} maxLength={80} onChange={(e) => setTplName(e.target.value)} /></Field>
              <Button variant="secondary" disabled={tplName.trim().length < 2} pending={tpl.pending} icon={<Save className="size-5" aria-hidden />} onClick={() => tpl.run({ name: tplName, title, body })}>{t.saveTemplate}</Button>
            </div>
          ) : null}
        </section>

        <section className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <h2 className="text-lg">{t.when}</h2>
          <div className="flex flex-wrap gap-2">
            <Chip on={!later} onClick={() => setLater(false)}>{t.now}</Chip>
            <Chip on={later} onClick={() => setLater(true)}>{t.later}</Chip>
          </div>
          {later ? <Field label={t.at}><Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></Field> : null}
          <p className="text-sm text-ink-3">{t.emailNote}</p>
        </section>
      </div>

      <section className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 lg:sticky lg:top-4 lg:self-start" aria-live="polite">
        {!list ? (
          <>
            <p className="text-ink-2">{t.recipientsHint}</p>
            <Button className="w-full" variant="secondary" disabled={!audiences.length || (coach && !groups.length)} pending={preview.pending}
              icon={<Users className="size-5" aria-hidden />} onClick={() => preview.run(audience)}>{t.preview}</Button>
          </>
        ) : (
          <>
            <h2 className="text-lg">{t.recipients(count)}</h2>
            {!list.length ? <p className="text-ink-3">{t.noRecipients}</p> : (
              <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-[var(--radius-control)] border border-line">
                {list.map((r) => {
                  const on = !excluded.includes(r.user_id);
                  return (
                    <li key={r.user_id}>
                      <label className={cn("flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2", !on && "opacity-60")}>
                        <input type="checkbox" className="size-5 accent-[var(--color-brand)]" checked={on} onChange={() => setExcluded(toggle(excluded, r.user_id))} />
                        <span className="min-w-0">
                          <span className="block font-semibold">{r.full_name}</span>
                          <span className="block text-sm text-ink-3">{r.reason === "staff" ? ROLE_LABELS[r.role as AppRole] ?? r.reason : r.reason}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {excluded.length ? <p className="text-sm text-ink-3">{t.excluded(excluded.length)}</p> : null}
          </>
        )}
        <FormError>{preview.error ?? send.error ?? tpl.error}</FormError>
        <Button className="w-full" size="lg" disabled={!ready} pending={send.pending} icon={<Send className="size-5" aria-hidden />}
          onClick={() => send.run({ title, body, audience, scheduledAt: scheduledIso })}>
          {later ? t.schedule(count) : t.send(count)}
        </Button>
      </section>
    </div>
  );
}
