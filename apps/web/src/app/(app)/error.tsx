"use client";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl">Pagina nu a putut fi încărcată</h1>
      <p className="max-w-sm text-ink-3">Verifică conexiunea la internet și încearcă din nou. Dacă problema persistă, anunță preparatorul fizic.</p>
      <Button onClick={reset}>Încearcă din nou</Button>
    </div>
  );
}
