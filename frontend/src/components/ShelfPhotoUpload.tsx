'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 8 * 1024 * 1024;

type Props = {
  onUpload: (file: File) => Promise<void>;
};

export default function ShelfPhotoUpload({ onUpload }: Readonly<Props>) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const pickFile = useCallback((next: File | null) => {
    setHint(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) {
      setHint('Use JPEG, PNG, or WebP.');
      return;
    }
    if (next.size > MAX_BYTES) {
      setHint('Photo must be 8 MB or smaller.');
      return;
    }
    setFile(next);
  }, []);

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    pickFile(event.target.files?.[0] ?? null);
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    pickFile(event.dataTransfer.files?.[0] ?? null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setHint(null);
    try {
      await onUpload(file);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not parse this shelf photo. Please try again.';
      setHint(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="wt-card p-6 mb-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-4">
        <h3 className="font-semibold text-base">Add from a shelf photo</h3>
        <span className="text-xs font-medium uppercase tracking-wide text-(--muted) shrink-0">
          Max 8 MB · JPEG / PNG / WebP
        </span>
      </div>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={onInputChange}
      />

      <section
        aria-label="Drop zone for a shelf photo"
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragActive(false);
        }}
        onDrop={onDrop}
        className={[
          'relative rounded-xl border-2 border-dashed transition-colors overflow-hidden',
          dragActive
            ? 'border-[#2d6a4f] bg-[#2d6a4f]/5'
            : 'border-[#e5ecd9] bg-[#f9faf6] hover:border-[#b8c9a8] hover:bg-white',
        ].join(' ')}
      >
        {previewUrl ? (
          <div className="flex flex-col sm:flex-row sm:items-stretch">
            <div className="relative sm:w-[min(100%,320px)] shrink-0 bg-black/5">
              <img
                src={previewUrl}
                alt="Selected shelf preview"
                className="h-44 w-full sm:h-full sm:min-h-44 object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col justify-center gap-3 p-4 sm:p-5">
              <p className="text-sm font-medium text-(--foreground,#111)">
                {file?.name ?? 'Photo selected'}
              </p>
              <p className="text-xs text-(--muted)">
                <label htmlFor={inputId} className="cursor-pointer font-semibold text-[#2d6a4f] underline-offset-2 hover:underline">
                  Replace photo
                </label>
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleUpload()}
                  disabled={!file || uploading}
                  className="wt-btn wt-btn-primary px-4 py-2 text-sm disabled:opacity-50"
                >
                  {uploading ? 'Parsing shelf…' : 'Parse shelf'}
                </button>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  disabled={uploading}
                  className="wt-btn wt-btn-secondary px-4 py-2 text-sm disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 px-6 py-12 text-center"
          >
            <div className="rounded-full bg-white/80 p-3 shadow-sm ring-1 ring-[#e5ecd9]">
              <svg className="h-7 w-7 text-[#2d6a4f]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-(--foreground,#111)">
              Drag & drop a shelf photo here
            </p>
            <p className="text-xs text-(--muted)">
              or <span className="text-[#2d6a4f] font-semibold">click to browse</span>
            </p>
          </label>
        )}
      </section>

      {hint ? (
        <p className="mt-3 text-sm text-red-700">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
