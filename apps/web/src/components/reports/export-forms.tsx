"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { Field, Select } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";

type Option = { value: string; label: string };
type Labels = { pdf: string; xlsx: string };

/** Descărcarea este un link obișnuit către ruta de export, cu parametrii în URL: merge la fel pe telefon. */
function DownloadLink({ href, children, primary }: { href: string; children: string; primary?: boolean }) {
  return (
    <a href={href} download className={buttonClass(primary ? "primary" : "secondary", "md", "w-full sm:w-auto")}>
      <Download className="size-5" aria-hidden />
      {children}
    </a>
  );
}

export function PlayerSheetForm({ groups, playerLabel, labels }: {
  groups: Array<{ label: string; players: Option[] }>; playerLabel: string; labels: Labels;
}) {
  const [player, setPlayer] = useState(groups[0]?.players[0]?.value ?? "");
  return (
    <div className="grid gap-3">
      <Field label={playerLabel}>
        <Select value={player} onChange={(e) => setPlayer(e.target.value)}>
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.players.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </optgroup>
          ))}
        </Select>
      </Field>
      <div><DownloadLink primary href={`/rapoarte/jucator/${player}`}>{labels.pdf}</DownloadLink></div>
    </div>
  );
}

export function WeeklyForm({ groups, weeks, groupLabel, weekLabel, labels }: {
  groups: Option[]; weeks: Option[]; groupLabel: string; weekLabel: string; labels: Labels;
}) {
  const [group, setGroup] = useState(groups[0]?.value ?? "");
  const [week, setWeek] = useState(weeks[0]?.value ?? "");
  const href = (format: "pdf" | "xlsx") => `/rapoarte/grupa/${group}?saptamana=${week}&format=${format}`;
  return (
    <div className="grid gap-3">
      <div className="grid gap-3">
        <Field label={groupLabel}>
          <Select value={group} onChange={(e) => setGroup(e.target.value)}>
            {groups.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </Select>
        </Field>
        <Field label={weekLabel}>
          <Select value={week} onChange={(e) => setWeek(e.target.value)}>
            {weeks.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <DownloadLink primary href={href("pdf")}>{labels.pdf}</DownloadLink>
        <DownloadLink href={href("xlsx")}>{labels.xlsx}</DownloadLink>
      </div>
    </div>
  );
}

export function RosterForm({ groups, groupLabel, labels }: { groups: Option[]; groupLabel: string; labels: Labels }) {
  const [group, setGroup] = useState(groups[0]?.value ?? "toate");
  return (
    <div className="grid gap-3">
      <Field label={groupLabel}>
        <Select value={group} onChange={(e) => setGroup(e.target.value)}>
          {groups.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </Select>
      </Field>
      <div><DownloadLink primary href={`/rapoarte/jucatori?grupa=${group}`}>{labels.xlsx}</DownloadLink></div>
    </div>
  );
}
