import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PageHeader } from "@/components/amphis/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import {
  getNotificationPreferences,
  listMyNotifications,
  markNotificationsRead,
  updateNotificationPreferences,
} from "@/lib/notifications/notifications.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Amphis" },
      {
        name: "description",
        content: "In-app Amphis notifications from real follow and wallet sync events.",
      },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyNotifications);
  const markFn = useServerFn(markNotificationsRead);
  const prefsFn = useServerFn(getNotificationPreferences);
  const updatePrefsFn = useServerFn(updateNotificationPreferences);

  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn({ data: { limit: 40 } }),
  });
  const prefs = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: () => prefsFn(),
  });

  const markAll = useMutation({
    mutationFn: () => markFn({ data: { all: true } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const savePrefs = useMutation({
    mutationFn: (next: { follows: boolean; walletSync: boolean }) => updatePrefsFn({ data: next }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notification-prefs"] }),
  });

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        title="Notifications"
        description="Only real follow and wallet sync events. No fabricated alerts."
      />

      <div className="mt-8 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Preferences</p>
        {prefs.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        ) : prefs.data ? (
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.data.follows}
                onChange={(e) =>
                  savePrefs.mutate({
                    follows: e.target.checked,
                    walletSync: prefs.data!.walletSync,
                  })
                }
              />
              New followers
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.data.walletSync}
                onChange={(e) =>
                  savePrefs.mutate({
                    follows: prefs.data!.follows,
                    walletSync: e.target.checked,
                  })
                }
              />
              Wallet sync complete / failure
            </label>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Unread: {list.data?.unreadCount ?? "—"}</p>
        <button
          type="button"
          className="text-xs text-accent hover:underline"
          onClick={() => markAll.mutate()}
          disabled={markAll.isPending}
        >
          Mark all read
        </button>
      </div>

      <div className="mt-4">
        {list.isLoading ? (
          <LoadingState label="Loading notifications" />
        ) : list.isError ? (
          <ErrorState
            title="Could not load notifications"
            description="Apply migrations 0008/0009 if tables are missing."
            onRetry={() => void list.refetch()}
          />
        ) : !list.data?.notifications.length ? (
          <EmptyState
            title="No notifications yet"
            description="You’ll see updates here when someone follows you or a wallet sync finishes or fails."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {list.data.notifications.map((n) => (
              <li key={n.id} className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {!n.read_at ? (
                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" />
                      ) : null}
                      {n.title}
                    </p>
                    {n.body ? <p className="mt-1 text-muted-foreground">{n.body}</p> : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()} · {n.type}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
