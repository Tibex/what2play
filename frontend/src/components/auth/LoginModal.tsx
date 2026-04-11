'use client';

import { useEffect } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import { useRegisterModalStore } from '@/lib/register-modal-store';

type LoginModalProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
}>;

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const openRegisterModal = useRegisterModalStore((s) => s.open);

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
      <button type="button" aria-label="Close sign in modal" onClick={onClose} className="absolute inset-0" />
      <dialog open className="relative z-10 w-full max-w-md bg-transparent">

        <LoginForm
          onSuccess={onClose}
          onRequestRegister={() => {
            onClose();
            openRegisterModal();
          }}
        />
      </dialog>
    </div>
  );
}
