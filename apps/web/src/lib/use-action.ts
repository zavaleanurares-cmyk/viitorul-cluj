"use client";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "./actions";

/**
 * Rulează o acțiune de server dintr-o componentă client: stare de așteptare, mesaj de eroare,
 * confirmare (toast) și reîmprospătarea paginii.
 *
 *   const save = useAction(savePlayer, { onSuccess: () => setOpen(false) });
 *   <Button pending={save.pending} onClick={() => save.run(values)}>Salvează</Button>
 *   <FormError>{save.error}</FormError>
 */
export function useAction<A extends unknown[], T>(
  action: (...args: A) => Promise<ActionResult<T>>,
  opts: { onSuccess?: (data: T) => void; successMessage?: string | false; refresh?: boolean } = {},
) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: A): Promise<ActionResult<T>> => {
      setBusy(true);
      setError(null);
      let res: ActionResult<T>;
      try {
        res = await action(...args);
      } catch {
        res = { ok: false, error: "Nu s-a putut contacta serverul. Verifică conexiunea." };
      }
      setBusy(false);
      if (res.ok) {
        const msg = opts.successMessage === false ? null : opts.successMessage ?? res.message ?? null;
        if (msg) toast(msg);
        opts.onSuccess?.(res.data);
        if (opts.refresh !== false) startTransition(() => router.refresh());
      } else {
        setError(res.error);
        toast(res.error, "error");
      }
      return res;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [action],
  );

  return { run, pending: busy || pending, error, clearError: () => setError(null) };
}
