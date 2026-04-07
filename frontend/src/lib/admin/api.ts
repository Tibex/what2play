import { api } from '@/lib/api';
import type {
  AdminActivityItem,
  AdminIncompleteCatalogEntry,
  AdminCatalogStats,
  AdminEventsSummary,
  AdminUsersSummary,
  GameEvent,
  PaginatedResponse,
  User,
} from '@/lib/types';

export type AdminCatalogSyncResult = {
  status: 'executed' | 'skipped' | 'queued';
  reason?: 'cooldown' | 'already_running';
  imported?: number;
  fetched?: number;
  requested?: number;
  nextEligibleAt?: string;
};

export type AdminCatalogRepairResult = {
  scanned: number;
  repaired: number;
};

export const adminApi = {
  getUsers: (page: number, search = '') => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '20',
    });
    if (search.trim()) params.set('search', search.trim());
    return api.get<PaginatedResponse<User>>(`/users?${params.toString()}`);
  },
  getEvents: (page: number) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '20',
    });
    return api.get<PaginatedResponse<GameEvent>>(`/events/admin/all?${params.toString()}`);
  },
  getUsersSummary: () => api.get<AdminUsersSummary>('/users/admin/summary'),
  getEventsSummary: () => api.get<AdminEventsSummary>('/events/admin/summary'),
  getUsersActivity: (page: number) =>
    api.get<PaginatedResponse<AdminActivityItem>>(
      `/users/admin/activity?page=${page}&pageSize=20`,
    ),
  getCatalogStats: () => api.get<AdminCatalogStats>('/bgg/admin/catalog-stats'),
  getIncompleteCatalog: (page = 1, pageSize = 100) =>
    api.get<{
      items: AdminIncompleteCatalogEntry[];
      meta: { page: number; pageSize: number; total: number; hasNext: boolean };
    }>(`/bgg/admin/incomplete-catalog?page=${page}&pageSize=${pageSize}`),
  deleteUser: (userId: string) => api.delete<void>(`/users/${userId}`),
  deleteEvent: (eventId: string) => api.delete<void>(`/events/admin/${eventId}`),
  deleteGame: (gameId: string) => api.delete<void>(`/games/admin/${gameId}`),
  syncCatalogTop500: () =>
    api.post<AdminCatalogSyncResult>('/bgg/admin/import-top-catalog?limit=500'),
  repairCatalogIncomplete: () =>
    api.post<AdminCatalogRepairResult>('/bgg/admin/repair-incomplete-catalog?limit=500'),
};
