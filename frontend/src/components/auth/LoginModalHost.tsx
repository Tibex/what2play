'use client';

import LoginModal from '@/components/auth/LoginModal';
import { useLoginModalStore } from '@/lib/login-modal-store';

export default function LoginModalHost() {
  const isOpen = useLoginModalStore((s) => s.isOpen);
  const close = useLoginModalStore((s) => s.close);

  return <LoginModal isOpen={isOpen} onClose={close} />;
}
