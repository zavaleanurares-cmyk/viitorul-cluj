export default function Loading() {
  return (
    <div className="flex justify-center py-20" role="status" aria-label="Se încarcă">
      <span className="size-8 animate-spin rounded-full border-4 border-brand border-r-transparent" aria-hidden />
    </div>
  );
}
