import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import DashboardPage from './page';
import { useAuthStore } from '@/lib/store';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: getMock,
  },
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'me',
        email: 'me@example.com',
        name: 'Me',
        subscriptionTier: 'free',
        role: 'user',
      },
      isAuthenticated: true,
    });

    getMock.mockImplementation(async (path: string) => {
      if (path === '/events') {
        return [
          {
            id: 'event-1',
            hostId: 'host-1',
            host: {
              id: 'host-1',
              email: 'host@example.com',
              name: 'Host',
              subscriptionTier: 'free',
              role: 'user',
            },
            title: 'Friday Game Night',
            dateTime: '2030-01-01T19:00:00.000Z',
            eventTimezone: 'UTC',
            type: 'invite',
            status: 'planning',
            discoveryMode: false,
            attendees: [
              {
                id: 'a-1',
                eventId: 'event-1',
                userId: 'host-1',
                rsvpStatus: 'going',
              },
              {
                id: 'a-2',
                eventId: 'event-1',
                userId: 'me',
                rsvpStatus: 'pending',
              },
            ],
            candidates: [],
            createdAt: '2030-01-01T12:00:00.000Z',
          },
        ];
      }
      if (path === '/events/open') {
        return [];
      }
      throw new Error(`Unexpected GET path: ${path}`);
    });
  });

  it('shows a pending invite marker for invited events', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Friday Game Night')).toBeInTheDocument();
    });

    expect(screen.getByText('Pending invite')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Friday Game Night/i }),
    ).toHaveAttribute('href', '/events/event-1');
  });
});
