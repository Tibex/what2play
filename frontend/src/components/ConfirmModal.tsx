'use client';

import { useEffect } from 'react';

type ConfirmModalProps = Readonly<{
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}>;

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen || isConfirming) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isConfirming, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f251d]/55 px-4">
      <button
        type="button"
        aria-label="Close confirmation dialog"
        onClick={() => {
          if (!isConfirming) onCancel();
        }}
        className="absolute inset-0"
      />
      <dialog
        open
        aria-labelledby="confirm-modal-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-[var(--paper)] p-5 shadow-[var(--shadow-raised)]"
      >
        <h2 id="confirm-modal-title" className="text-lg font-semibold text-[var(--foreground)]">
          {title}
        </h2>
        <p className="wt-muted mt-2 text-sm">{message}</p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="wt-btn wt-btn-secondary px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="wt-btn rounded-lg border border-[var(--danger)] bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white hover:bg-[#8b332b] disabled:opacity-50"
          >
            {isConfirming ? 'Working...' : confirmLabel}
          </button>
        </div>
      </dialog>
    </div>
  );
}
