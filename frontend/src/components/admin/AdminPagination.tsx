export default function AdminPagination({
  page,
  hasNext,
  onPrev,
  onNext,
}: Readonly<{
  page: number;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}>) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        className="rounded border px-3 py-1 text-sm disabled:opacity-50"
      >
        Prev
      </button>
      <span className="wt-muted text-sm">Page {page}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        className="rounded border px-3 py-1 text-sm disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
