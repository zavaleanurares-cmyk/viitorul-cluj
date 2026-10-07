"use client";
import { useState } from "react";
import { Save, Trash2 } from "lucide-react";
import type { ColumnMapping, PhysicalDefaults } from "@club/shared";
import { Button, IconButton } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { deleteTemplate, saveTemplate } from "@/app/(app)/import/actions";
import { Section } from "./parts";
import { applyTemplate, templateMatches, toTemplate } from "./prepare";
import type { ImportTemplate, TemplateMapping } from "./types";

/** Șabloane de mapare pentru datele fizice: salvare, aplicare, ștergere și propunere automată. */
export function TemplatesPanel({ templates, headers, mapping, suggested, defaults, onApply }: {
  templates: ImportTemplate[]; headers: string[]; mapping: ColumnMapping; suggested: ColumnMapping; defaults: PhysicalDefaults;
  onApply: (mapping: ColumnMapping, defaults: TemplateMapping["defaults"]) => void;
}) {
  const t = useT().imports.templates;
  const [selected, setSelected] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [name, setName] = useState("");
  const save = useAction(saveTemplate, { onSuccess: (d) => { setName(""); setSelected(d.id); setApplied(d.id); } });
  const remove = useAction(deleteTemplate, { onSuccess: () => { setSelected(""); setApplied(null); } });

  const apply = (tpl: ImportTemplate) => {
    onApply(applyTemplate(tpl.mapping, headers, suggested), tpl.mapping.defaults);
    setApplied(tpl.id);
    setSelected(tpl.id);
  };
  const current = templates.find((x) => x.id === selected);
  const matching = templates.find((x) => templateMatches(x.mapping, headers));
  const appliedName = templates.find((x) => x.id === applied)?.name;

  return (
    <Section title={t.title} description={t.description}>
      {matching && applied !== matching.id && !dismissed ? (
        <Notice tone="blue" title={t.suggestTitle(matching.name)} className="mb-3">
          <p>{t.suggestBody}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => apply(matching)}>{t.applyNamed(matching.name)}</Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>{t.keepProposed}</Button>
          </div>
        </Notice>
      ) : null}
      {appliedName ? <p className="mb-3 text-sm font-semibold text-ink-2">{t.applied(appliedName)}</p> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex items-end gap-2">
          <Field label={t.saved} className="min-w-0 flex-1">
            <Select value={selected} onChange={(e) => setSelected(e.target.value)} disabled={!templates.length}>
              <option value="">{templates.length ? t.choose : t.none}</option>
              {templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </Field>
          <Button variant="secondary" disabled={!current} onClick={() => current && apply(current)}>{t.apply}</Button>
          <IconButton
            label={current ? t.delete(current.name) : t.deleteNone} disabled={!current || remove.pending}
            onClick={() => current && window.confirm(t.deleteConfirm(current.name)) && remove.run({ id: current.id })}
            className="border border-line-strong"
          >
            <Trash2 className="size-5" aria-hidden />
          </IconButton>
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) void save.run({ name: name.trim(), mapping: toTemplate(headers, mapping, defaults) }); }}
        >
          <Field label={t.newName} className="min-w-0 flex-1">
            <Input value={name} maxLength={80} placeholder={t.newNamePlaceholder} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" variant="secondary" pending={save.pending} disabled={!name.trim()} icon={<Save className="size-5" aria-hidden />}>{t.save}</Button>
        </form>
      </div>
      <div className="mt-2"><FormError>{save.error ?? remove.error}</FormError></div>
    </Section>
  );
}
