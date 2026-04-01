import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import OpenEventsPage from './page';
import { useAuthStore } from '@/lib/store';

const { getMock, postMock, pushMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  });
  return { default: toast };
});

vi.mock('@/lib/api', () => ({
  api: {
    get: getMock,
    post: postMock,
  },
}));

describe('OpenEventsPage', () => {
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
  });

  it('renders empty state when no open events are available', async () => {
    getMock.mockResolvedValueOnce([]);

    render(<OpenEventsPage />);

    await waitFor(() => {
      expect(
        screen.getByText('No open events right now'),
      ).toBeInTheDocument();
    });
  });

  it('joins an open event and refreshes list', async () => {
    getMock
      .mockResolvedValueOnce([
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
          title: 'Open Friday Night',
          dateTime: '2030-01-01T19:00:00.000Z',
          eventTimezone: 'UTC',
          type: 'open',
          status: 'planning',
          discoveryMode: false,
          attendees: [],
          candidates: [],
          createdAt: '2030-01-01T12:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
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
          title: 'Open Friday Night',
          dateTime: '2030-01-01T19:00:00.000Z',
          eventTimezone: 'UTC',
          type: 'open',
          status: 'planning',
          discoveryMode: false,
          attendees: [{ id: 'a1', eventId: 'event-1', userId: 'me', rsvpStatus: 'going' }],
          candidates: [],
          createdAt: '2030-01-01T12:00:00.000Z',
        },
      ]);
    postMock.mockResolvedValueOnce({});

    render(<OpenEventsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/events/event-1/rsvp', {
        status: 'going',
      });
    });
    await waitFor(() => {
      expect(screen.getByText('Joined')).toBeInTheDocument();
    });
  });

  it('opens event details when card is clicked', async () => {
    getMock.mockResolvedValueOnce([
      {
        id: 'event-2',
        hostId: 'host-1',
        host: {
          id: 'host-1',
          email: 'host@example.com',
          name: 'Host',
          subscriptionTier: 'free',
          role: 'user',
        },
        title: 'Open Thursday Night',
        dateTime: '2030-01-02T19:00:00.000Z',
        eventTimezone: 'UTC',
        type: 'open',
        status: 'planning',
        discoveryMode: false,
        attendees: [],
        candidates: [],
        createdAt: '2030-01-01T12:00:00.000Z',
      },
    ]);

    render(<OpenEventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Open Thursday Night')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Open Thursday Night/i }));

    expect(pushMock).toHaveBeenCalledWith('/events/event-2');
  });
});
