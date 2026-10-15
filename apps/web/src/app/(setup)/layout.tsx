/** Pași obligatorii după prima autentificare: parolă proprie și consimțământ. */
export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-surface">
      <div className="mx-auto w-full max-w-xl px-5 pb-10 pt-[calc(2rem+env(safe-area-inset-top,0px))]">{children}</div>
    </main>
  );
}
