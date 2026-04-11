'use client';

import { useEffect } from 'react';
import RegisterForm from '@/components/auth/RegisterForm';

type RegisterModalProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
  onRequestLogin?: () => void;
}>;

export default function RegisterModal({ isOpen, onClose, onRequestLogin }: RegisterModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f251d]/55 px-4">
      <button
        type="button"
        aria-label="Close sign up modal"
        onClick={onClose}
        className="absolute inset-0"
      />
      <dialog
        open
        className="relative z-10 w-full max-w-md bg-transparent"
      >

        <RegisterForm onSuccess={onClose} onRequestLogin={onRequestLogin} />
      </dialog>
    </div>
  );
}
