'use client';

import { useMemo, useState } from 'react';

type Props = {
  onUpload: (file: File, previewUrl: string) => Promise<void>;
};

export default function ShelfPhotoUpload({ onUpload }: Readonly<Props>) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file, previewUrl);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="wt-card p-6 mb-6">
      <h3 className="font-semibold mb-3">Upload shelf photo</h3>
      <div className="flex flex-col gap-3">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <button
          onClick={() => void handleUpload()}
          disabled={!file || uploading}
          className="wt-btn wt-btn-primary px-4 py-2 disabled:opacity-50 w-fit"
        >
          {uploading ? 'Parsing...' : 'Parse shelf'}
        </button>
      </div>
    </div>
  );
}
