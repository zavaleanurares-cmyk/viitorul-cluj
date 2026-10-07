"use client";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { markAllRead } from "@/app/(app)/notificari/actions";

export function MarkAllButton({ label }: { label: string }) {
  const mark = useAction(markAllRead);
  return (
    <Button variant="secondary" pending={mark.pending} onClick={() => mark.run()} icon={<CheckCheck className="size-5" aria-hidden />}>
      {label}
    </Button>
  );
}
