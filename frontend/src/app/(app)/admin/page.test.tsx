import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import AdminEventsPage from "./events/page";
import AdminOverviewPage from "./overview/page";
import { useAuthStore } from "@/lib/store";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: "admin-1",
        email: "admin@example.com",
        name: "Admin",
        subscriptionTier: "pro",
        role: "admin",
      },
      isAuthenticated: true,
    });

    getMock.mockImplementation(async (path: string) => {
      if (path === "/users?page=1&pageSize=20") {
        return {
          items: [],
          meta: { page: 1, pageSize: 20, total: 0, hasNext: false },
        };
      }
      if (path === "/events/admin/all?page=1&pageSize=20") {
        return {
          items: [
            {
              id: "event-1",
              hostId: "host-1",
              host: {
                id: "host-1",
                email: "host@example.com",
                name: "Host",
                subscriptionTier: "free",
                role: "user",
              },
              title: "Reported Open Night",
              dateTime: "2030-01-01T19:00:00.000Z",
              eventTimezone: "UTC",
              type: "open",
              status: "planning",
              discoveryMode: false,
              attendees: [],
              candidates: [],
              createdAt: "2030-01-01T12:00:00.000Z",
              openReportCount: 2,
              lastReportedAt: "2030-01-01T15:00:00.000Z",
            },
          ],
          meta: { page: 1, pageSize: 20, total: 1, hasNext: false },
        };
      }
      if (path === "/bgg/admin/catalog-stats") {
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
            missingThumbnail: 0,
          },
        };
      }
      if (path === "/users/admin/summary") {
        return { totalUsers: 10, totalAdmins: 1, usersLast7d: 2 };
      }
      if (path === "/events/admin/summary") {
        return {
          totalEvents: 8,
          openEvents: 3,
          reportedOpenEvents: 1,
          reportsLast7d: 2,
        };
      }
      if (path === "/users/admin/activity?page=1&pageSize=20") {
        return {
          items: [
            {
              id: "act-1",
              type: "user_created",
              title: "Jane Doe",
              subtitle: "jane@example.com",
              userId: "user-2",
              createdAt: "2030-01-01T15:00:00.000Z",
            },
          ],
          meta: { page: 1, pageSize: 20, total: 1, hasNext: false },
        };
      }
      throw new Error(`Unexpected GET path: ${path}`);
    });
  });

  it("renders event type and created timestamp in events table", async () => {
    render(<AdminEventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Reported Open Night")).toBeInTheDocument();
    });

    const rowTitle = await screen.findByText("Reported Open Night");
    const row = rowTitle.closest("tr");
    expect(row).not.toBeNull();
    const scoped = within(row as HTMLTableRowElement);
    expect(scoped.getByText("open")).toBeInTheDocument();
    expect(scoped.queryByText("—")).not.toBeInTheDocument();
  });

  it("renders overview metrics and activity feed", async () => {
    render(<AdminOverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Total users")).toBeInTheDocument();
    });
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Recent users activity")).toBeInTheDocument();
    expect(screen.getByText(/User ID: user-2/)).toBeInTheDocument();
  });

  it("blocks non-admin users from admin routes", () => {
    useAuthStore.setState({
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "User",
        subscriptionTier: "free",
        role: "user",
      },
      isAuthenticated: true,
    });
    render(<AdminEventsPage />);
    expect(screen.getByText("Admin access required.")).toBeInTheDocument();
  });
});
