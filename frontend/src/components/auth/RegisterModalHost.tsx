'use client';

import RegisterModal from '@/components/auth/RegisterModal';
import { useLoginModalStore } from '@/lib/login-modal-store';
import { useRegisterModalStore } from '@/lib/register-modal-store';

export default function RegisterModalHost() {
  const isOpen = useRegisterModalStore((s) => s.isOpen);
  const close = useRegisterModalStore((s) => s.close);
  const openLoginModal = useLoginModalStore((s) => s.open);

  return (
    <RegisterModal
      isOpen={isOpen}
      onClose={close}
      onRequestLogin={() => {
        close();
        openLoginModal();
      }}
    />
  );
}
