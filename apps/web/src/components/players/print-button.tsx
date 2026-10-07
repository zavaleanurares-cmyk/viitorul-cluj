"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="secondary" className="no-print hidden md:inline-flex" icon={<Printer className="size-5" aria-hidden />} onClick={() => window.print()}>
      {label}
    </Button>
  );
}
