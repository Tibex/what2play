import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import EventDetailPage from './page';
import { useAuthStore } from '@/lib/store';

const {
  getMock,
  postMock,
  patchMock,
  deleteMock,
} = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'event-1' }),
  useRouter: () => ({ push: vi.fn() }),
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
    patch: patchMock,
    delete: deleteMock,
  },
}));

describe('EventDetailPage', () => {
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
      if (path === '/events/event-1') {
        return {
          id: 'event-1',
          hostId: 'host-1',
          host: { id: 'host-1', name: 'Host', email: 'host@example.com' },
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
              userId: 'me',
              user: {
                id: 'me',
                email: 'me@example.com',
                name: 'Me',
                subscriptionTier: 'free',
                role: 'user',
              },
              rsvpStatus: 'pending',
            },
            {
              id: 'a-2',
              eventId: 'event-1',
              userId: 'u-2',
              user: {
                id: 'u-2',
                email: 'friend@example.com',
                name: 'Friend',
                subscriptionTier: 'free',
                role: 'user',
              },
              rsvpStatus: 'going',
            },
          ],
          candidates: [],
          createdAt: '2030-01-01T12:00:00.000Z',
        };
      }

      if (path === '/friends') {
        return [];
      }

      if (path === '/friends/pending/sent') {
        return [
          {
            id: 'f-1',
            requesterId: 'me',
            addresseeId: 'u-2',
            status: 'pending',
            requester: {
              id: 'me',
              email: 'me@example.com',
              name: 'Me',
              subscriptionTier: 'free',
              role: 'user',
            },
            addressee: {
              id: 'u-2',
              email: 'friend@example.com',
              name: 'Friend',
              subscriptionTier: 'free',
              role: 'user',
            },
          },
        ];
      }

      throw new Error(`Unexpected GET path: ${path}`);
    });
  });

  it('shows invite and friend-request pending markers after load', async () => {
    render(<EventDetailPage />);

    await waitFor(() => {
      expect(screen.getByTitle('Request pending')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Join event' })).toBeInTheDocument();
    expect(
      screen.getByText('Join this event to view recommendations, voting, and feedback.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Add a game manually')).not.toBeInTheDocument();
  });

  it('shows manual game add controls for joined attendees', async () => {
    getMock.mockImplementation(async (path: string) => {
      if (path === '/events/event-1') {
        return {
          id: 'event-1',
          hostId: 'host-1',
          host: { id: 'host-1', name: 'Host', email: 'host@example.com' },
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
              userId: 'me',
              user: {
                id: 'me',
                email: 'me@example.com',
                name: 'Me',
                subscriptionTier: 'free',
                role: 'user',
              },
              rsvpStatus: 'going',
            },
          ],
          candidates: [],
          createdAt: '2030-01-01T12:00:00.000Z',
        };
      }
      if (path === '/friends') {
        return [];
      }
      if (path === '/friends/pending/sent') {
        return [];
      }
      throw new Error(`Unexpected GET path: ${path}`);
    });

    render(<EventDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Add a game manually')).toBeInTheDocument();
    });
  });

  it('does not render "Can\'t make it" for the event creator', async () => {
    useAuthStore.setState({
      user: {
        id: 'host-1',
        email: 'host@example.com',
        name: 'Host',
        subscriptionTier: 'free',
        role: 'user',
      },
      isAuthenticated: true,
    });

    getMock.mockImplementation(async (path: string) => {
      if (path === '/events/event-1') {
        return {
          id: 'event-1',
          hostId: 'host-1',
          host: { id: 'host-1', name: 'Host', email: 'host@example.com' },
          title: 'Friday Game Night',
          dateTime: '2030-01-01T19:00:00.000Z',
          eventTimezone: 'UTC',
          type: 'invite',
          status: 'planning',
          discoveryMode: false,
          attendees: [
            {
              id: 'a-host',
              eventId: 'event-1',
              userId: 'host-1',
              user: {
                id: 'host-1',
                email: 'host@example.com',
                name: 'Host',
                subscriptionTier: 'free',
                role: 'user',
              },
              rsvpStatus: 'going',
            },
          ],
          candidates: [],
          createdAt: '2030-01-01T12:00:00.000Z',
        };
      }

      if (path === '/friends') {
        return [];
      }

      if (path === '/friends/pending/sent') {
        return [];
      }

      throw new Error(`Unexpected GET path: ${path}`);
    });

    render(<EventDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Friday Game Night')).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: "Can't make it" }),
    ).not.toBeInTheDocument();
  });
});
