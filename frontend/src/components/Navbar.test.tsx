import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import Navbar from './Navbar';
import { useAuthStore } from '@/lib/store';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/dashboard',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'user-1',
        email: 'me@example.com',
        name: 'Me',
        subscriptionTier: 'free',
        role: 'user',
      },
      isAuthenticated: true,
    });
  });

  it('does not show a separate Open Events link in desktop navigation', () => {
    render(<Navbar />);
    expect(
      screen.queryByRole('link', { name: 'Open Events' }),
    ).not.toBeInTheDocument();
  });

  it('does not show Open Events link in mobile menu when opened', () => {
    render(<Navbar />);

    fireEvent.click(screen.getByLabelText('Open navigation menu'));

    expect(
      screen.queryByRole('link', { name: 'Open Events' }),
    ).not.toBeInTheDocument();
  });
});
