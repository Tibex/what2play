import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminPage from './page';
import { useAuthStore } from '@/lib/store';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: getMock,
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Admin',
        subscriptionTier: 'pro',
        role: 'admin',
      },
      isAuthenticated: true,
    });

    getMock.mockImplementation(async (path: string) => {
      if (path === '/users?page=1&pageSize=20') {
        return {
          items: [],
          meta: { page: 1, pageSize: 20, total: 0, hasNext: false },
        };
      }
      if (path === '/events/admin/all?page=1&pageSize=20') {
        return {
          items: [
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
              title: 'Reported Open Night',
              dateTime: '2030-01-01T19:00:00.000Z',
              eventTimezone: 'UTC',
              type: 'open',
              status: 'planning',
              discoveryMode: false,
              attendees: [],
              candidates: [],
              createdAt: '2030-01-01T12:00:00.000Z',
              openReportCount: 2,
              lastReportedAt: '2030-01-01T15:00:00.000Z',
            },
          ],
          meta: { page: 1, pageSize: 20, total: 1, hasNext: false },
        };
      }
      if (path === '/bgg/admin/catalog-stats') {
        return {
          syncState: {
            running: false,
            lastSuccessAt: null,
            lastAttemptAt: null,
            lastAttemptStatus: null,
            lastAttemptMessage: null,
            nextEligibleAt: null,
          },
          quality: {
            total: 0,
            missingRating: 0,
            missingWeight: 0,
            missingYear: 0,
            missingPoll: 0,
            missingPlayingTime: 0,
          },
        };
      }
      throw new Error(`Unexpected GET path: ${path}`);
    });
  });

  it('renders report count and last-report timestamp in events table', async () => {
    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Events' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Events' }));

    const rowTitle = await screen.findByText('Reported Open Night');
    const row = rowTitle.closest('tr');
    expect(row).not.toBeNull();
    const scoped = within(row as HTMLTableRowElement);
    expect(scoped.getByText('2')).toBeInTheDocument();
    expect(scoped.queryByText('—')).not.toBeInTheDocument();
  });
});
