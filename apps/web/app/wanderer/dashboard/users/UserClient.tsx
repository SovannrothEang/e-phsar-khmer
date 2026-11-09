"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Eye,
  RotateCcw,
  ShieldOff,
  Trash2,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAdminUsers,
  type AdminUsersResult,
  type GetAdminUsersParams,
} from "@/actions/admin-users";
import { deleteUser, restoreUserAccess, suspendUser } from "@/actions/user";
import { User } from "@/types/user";
import { AdminPage } from "@/components/dashboard/admin-page";
import {
  AdminFilter,
  AdminSearch,
  AdminTable,
  DateCell,
  PrimaryCell,
  RowActions,
  formatCount,
  type AdminColumn,
} from "@/components/dashboard/admin-table";
import { publicSiteOrigin } from "@/lib/site";

const PAGE_SIZE = 20;

/**
 * Tabs → backend filters. Only the account status is filtered server-side; the
 * page used to bucket Premium/Normal client-side over whatever single page had
 * been fetched, so those counts were never the real totals and search could not
 * see past the first 100 rows.
 *
 * `deleted` is included because a soft-deleted account lives for 90 days
 * before the purge, and staff need to find it in the meantime.
 */
const TABS: Record<
  string,
  Omit<GetAdminUsersParams, "page" | "q" | "pageSize">
> = {
  active: { status: "active" },
  suspended: { status: "suspended" },
  deleted: { status: "deleted" },
};

/** Soft tones, matching the other admin tables (not solid fills). */
const STATUS_TONE: Record<string, string> = {
  active:
    "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  suspended:
    "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  deleted:
    "border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

/** Stored numbers are already E.164 ("+855…"); the old `+{phone}` produced "++855…". */
function formatPhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

function AccountTypeBadge({ type }: { type: User["accountType"] }) {
  if (type === "Premium") {
    return (
      <Badge variant="outline">
        <BadgeCheck className="text-blue-500" />
        Premium
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <UserRound className="text-muted-foreground" />
      <p className="text-muted-foreground">Normal</p>
    </Badge>
  );
}

export default function UserPage({
  initialData,
}: {
  initialData?: AdminUsersResult;
}) {
  const queryClient = useQueryClient();
  const locale = useLocale();

  const [tab, setTab] = useState("active");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [accountType, setAccountType] = useState("all");
  const [verified, setVerified] = useState("all");
  const [page, setPage] = useState(1);

  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);
  const [reason, setReason] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const query: GetAdminUsersParams = {
    ...TABS[tab],
    q: q || undefined,
    accountType:
      accountType === "all" ? undefined : (accountType as "premium" | "normal"),
    verified: verified === "all" ? undefined : verified === "yes",
    page,
    pageSize: PAGE_SIZE,
  };

  // Server-side paging + search: a search now covers every account, not just
  // the first page the browser happened to have.
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", query],
    queryFn: () => getAdminUsers(query),
    // Only the default view has a server-rendered first page.
    initialData: tab === "active" && page === 1 && !q ? initialData : undefined,
    placeholderData: (prev) => prev,
    // Presence is a 2-minute window; a minute keeps the dot near the truth
    // without a per-render refetch. Hidden tabs stop (the default).
    refetchInterval: 60_000,
  });
  const rows = data?.users ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  // Tab counts: one pageSize=1 call per status under the current search, so the
  // badges agree with what the tab will show.
  const { data: tabCounts = {} } = useQuery({
    queryKey: ["admin", "users-counts", q ?? "", accountType, verified],
    queryFn: async () => {
      // allSettled: one preset failing must not zero the other badges.
      const results = await Promise.allSettled(
        Object.keys(TABS).map(async (key) => {
          const result = await getAdminUsers({
            ...TABS[key],
            q: q || undefined,
            accountType:
              accountType === "all"
                ? undefined
                : (accountType as "premium" | "normal"),
            verified: verified === "all" ? undefined : verified === "yes",
            page: 1,
            pageSize: 1,
          });
          return [key, result.total] as const;
        }),
      );
      const counts: Record<string, number> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          const [key, total] = result.value;
          counts[key] = total;
        }
      }
      return counts;
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "users-counts"] });
  };

  const suspendMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      suspendUser(userId, reason),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error ?? "Failed to suspend user");
        return;
      }
      toast.success(
        "Account suspended. Their sessions are revoked and they see your reason when they sign in.",
      );
      setSuspendTarget(null);
      setReason("");
      refresh();
    },
    onError: () => toast.error("Failed to suspend user"),
  });

  const restoreMutation = useMutation({
    mutationFn: (userId: string) => restoreUserAccess(userId),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error ?? "Failed to restore access");
        return;
      }
      toast.success("Access restored — the account can sign in again.");
      setRestoreTarget(null);
      refresh();
    },
    onError: () => toast.error("Failed to restore access"),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUser({ userId }),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error ?? "Failed to delete user");
        return;
      }
      toast.success("User deleted");
      setDeleteTarget(null);
      refresh();
    },
    onError: () => toast.error("Failed to delete user"),
  });

  const openProfile = (user: User) => {
    if (!user.username) {
      toast.error("This account has no username yet");
      return;
    }
    // The public profile lives on the MARKETPLACE origin: this dashboard runs
    // on the admin host, which 404s every non-/wanderer path.
    window.open(
      `${publicSiteOrigin(window.location.origin)}/${locale}/${user.username}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const columns = useMemo<AdminColumn<User>[]>(
    () => [
      {
        key: "user",
        header: "User",
        sortValue: (user) => user.name,
        cell: (user) => (
          <PrimaryCell
            shape="round"
            image={user.profileImage}
            alt={user.name}
            title={user.name}
            subtitle={user.email || "No email"}
          />
        ),
      },
      {
        key: "username",
        header: "Username",
        sortValue: (user) => user.username,
        cell: (user) =>
          user.username ? (
            <span className="text-muted-foreground">@{user.username}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "phone",
        header: "Phone",
        sortValue: (user) => formatPhone(user.networks[0] ?? ""),
        cell: (user) => {
          const phones = user.networks
            .filter((value) => value !== "")
            .map(formatPhone);
          if (phones.length === 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <div className="flex flex-col gap-0.5">
              <span>{phones[0]}</span>
              {phones.length > 1 ? (
                <span
                  className="type-meta text-muted-foreground"
                  title={phones.slice(1).join(", ")}
                >
                  +{phones.length - 1} more
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "status",
        header: "Status",
        sortValue: (user) => user.accountStatus,
        cell: (user) => (
          <div className="flex flex-col gap-1">
            <Badge
              variant="outline"
              className={STATUS_TONE[user.accountStatus] ?? ""}
            >
              {user.accountStatus}
            </Badge>
            {user.statusReason ? (
              // The reason staff typed is what the account is shown at sign-in.
              <span
                className="type-meta text-muted-foreground line-clamp-2 max-w-[16rem]"
                title={user.statusReason}
              >
                {user.statusReason}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: "presence",
        header: "Presence",
        sortValue: (user) => (user.status === "Online" ? 0 : 1),
        cell: (user) => (
          <span
            className="inline-flex items-center gap-1.5"
            title={
              user.lastSeenAt
                ? new Date(user.lastSeenAt).toLocaleString("en-GB", {
                    timeZone: "Asia/Phnom_Penh",
                  })
                : "Never active"
            }
          >
            <span
              className={`size-1.5 rounded-full ${
                user.status === "Online"
                  ? "bg-emerald-500"
                  : "bg-muted-foreground/40"
              }`}
            />
            <span className="type-body-sm">{user.status}</span>
          </span>
        ),
      },
      {
        key: "verified",
        header: "Verified",
        sortValue: (user) => (user.isVerified ? 1 : 0),
        cell: (user) => (
          <Badge variant="outline">
            <span
              className={`size-1.5 rounded-full ${
                user.isVerified ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            {user.isVerified ? "Yes" : "No"}
          </Badge>
        ),
      },
      {
        key: "accountType",
        header: "Account",
        sortValue: (user) => user.accountType,
        cell: (user) => <AccountTypeBadge type={user.accountType} />,
      },
      {
        key: "joined",
        header: "Joined",
        sortValue: (user) => user.createdAt,
        cell: (user) => <DateCell value={user.createdAt} />,
      },
      {
        key: "action",
        header: "Action",
        align: "center",
        cell: (user) => (
          <RowActions
            id={user.userId}
            actions={[
              ...(user.accountStatus === "deleted"
                ? []
                : [
                    {
                      label: "View profile",
                      icon: <Eye className="mr-2 size-4" />,
                      onSelect: () => openProfile(user),
                    },
                  ]),
              // Suspending is what an approved report does; restoring is the
              // lift, and until now it had no UI at all.
              ...(user.accountStatus === "active"
                ? [
                    {
                      label: "Suspend",
                      icon: <ShieldOff className="mr-2 size-4" />,
                      tone: "danger" as const,
                      onSelect: () => {
                        setSuspendTarget(user);
                        setReason("");
                      },
                    },
                  ]
                : user.accountStatus === "suspended"
                  ? [
                      {
                        label: "Restore access",
                        icon: <RotateCcw className="mr-2 size-4" />,
                        tone: "success" as const,
                        onSelect: () => setRestoreTarget(user),
                      },
                    ]
                  : []),
              {
                label: "Delete",
                icon: <Trash2 className="mr-2 size-4" />,
                tone: "danger" as const,
                onSelect: () => setDeleteTarget(user),
              },
            ]}
          />
        ),
      },
    ],
    // `openProfile` only reads props/states above; the columns rebuild when the
    // locale changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );

  const busy =
    suspendMutation.isPending ||
    restoreMutation.isPending ||
    deleteMutation.isPending;

  return (
    <>
      <AdminPage
        title="Users"
        description="Search every account, suspend one, or give a suspended account its access back"
        toolbar={
          <>
            <form
              className="w-full max-w-sm"
              onSubmit={(event) => {
                event.preventDefault();
                setQ(searchInput.trim());
                setPage(1);
              }}
            >
              <AdminSearch
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search name, username, email, phone… (Enter)"
              />
            </form>
            <AdminFilter
              value={accountType}
              onChange={(value) => {
                setAccountType(value);
                setPage(1);
              }}
              allLabel="All accounts"
              options={[
                { value: "premium", label: "Premium" },
                { value: "normal", label: "Normal" },
              ]}
            />
            <AdminFilter
              value={verified}
              onChange={(value) => {
                setVerified(value);
                setPage(1);
              }}
              allLabel="Any verification"
              options={[
                { value: "yes", label: "Verified" },
                { value: "no", label: "Unverified" },
              ]}
            />
          </>
        }
      >
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value);
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="active" className="cursor-pointer">
              Active
              <Badge className="ml-1.5 bg-emerald-500 type-meta text-white">
                {formatCount(tabCounts.active ?? 0)}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="suspended" className="cursor-pointer">
              Suspended
              <Badge className="ml-1.5 bg-amber-500 type-meta text-white">
                {formatCount(tabCounts.suspended ?? 0)}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="deleted" className="cursor-pointer">
              Deleted
              <Badge className="ml-1.5 bg-red-500 type-meta text-white">
                {formatCount(tabCounts.deleted ?? 0)}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <AdminTable
          columns={columns}
          rows={rows}
          rowKey={(user) => user.userId}
          isLoading={isLoading}
          resetKey={`${q}:${tab}`}
          emptyTitle="No users found"
          emptyHint={q ? `No results for "${q}"` : undefined}
          serverPagination={{
            page,
            totalPages,
            total: data?.total ?? 0,
            onPageChange: setPage,
            totalLabel: "users",
          }}
        />
      </AdminPage>

      {/* Suspend: the reason is required because it is the only thing the
          account can read when it is refused at sign-in. */}
      <Dialog
        open={suspendTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSuspendTarget(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend account</DialogTitle>
            <DialogDescription>
              <span className="font-semibold">{suspendTarget?.name}</span> is
              signed out of every device immediately, cannot sign in, and their
              ads stop showing in the marketplace. Nothing is deleted — you can
              restore access at any time.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Why? The account sees this when it tries to sign in."
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="h-9 rounded-sm cursor-pointer"
              onClick={() => setSuspendTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="h-9 rounded-sm cursor-pointer text-white bg-amber-600 hover:bg-amber-700 hover:text-white"
              disabled={busy || reason.trim().length < 3}
              onClick={() =>
                suspendTarget &&
                suspendMutation.mutate({
                  userId: suspendTarget.userId,
                  reason: reason.trim(),
                })
              }
            >
              {suspendMutation.isPending ? "Suspending…" : "Suspend"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={restoreTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore access</DialogTitle>
            <DialogDescription>
              <span className="font-semibold">{restoreTarget?.name}</span> can
              sign in again and their ads become visible. Their old sessions are
              already revoked, so they have to sign in once more.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="h-9 rounded-sm cursor-pointer"
              onClick={() => setRestoreTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="h-9 rounded-sm cursor-pointer"
              disabled={busy}
              onClick={() =>
                restoreTarget && restoreMutation.mutate(restoreTarget.userId)
              }
            >
              {restoreMutation.isPending ? "Restoring…" : "Restore access"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-red-500">
                {deleteTarget?.name}
              </span>
              ? The account is closed for 90 days and then removed for good, and
              its phone numbers are released. Prefer <b>Suspend</b> when you
              want the account back.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              className="h-9 rounded-sm cursor-pointer"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="h-9 text-white bg-red-500 rounded-sm hover:bg-red-600 hover:text-white cursor-pointer"
              disabled={busy}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.userId)
              }
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
