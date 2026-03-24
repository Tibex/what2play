/** Set when an unauthenticated user starts joining via invite; consumed after login/register. */
export const PENDING_INVITE_STORAGE_KEY = 'pendingInvite';

export function redirectPathAfterAuth(): string {
  if (typeof window === 'undefined') return '/dashboard';
  const inviteToken = localStorage.getItem(PENDING_INVITE_STORAGE_KEY);
  if (inviteToken) {
    localStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
    return `/invite/${inviteToken}`;
  }
  return '/dashboard';
}
