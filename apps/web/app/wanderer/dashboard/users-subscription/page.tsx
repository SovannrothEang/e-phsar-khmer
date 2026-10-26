"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreVertical, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import {
  getUserSubscriptions,
  grantSubscription,
  revokeUserSubscription,
  type UserSubscriptionRow,
} from "@/actions/admin-user-subscriptions";
import type { SupersededReason } from "@/types/subscription";
import { getAdminUsers } from "@/actions/admin-users";
import {
  getSubCategories,
  getSubPlans,
  getSubPackages,
  getSubTerms,
} from "@/actions/admin-subscriptions";

type Subscription = {
  id: string;
  accountId: string;
  name: string;
  email: string;
  phone: string;
  group: string;
  totalAds: number;
  totalRenew: number;
  autoRenew: number;
  plan: string;
  price: number;
  paymentMethod: string;
  subscribedAt: string;
  expiredAt: string;
  status: UserSubscriptionRow["status"];
  supersededReason: SupersededReason | null;
};

// A superseded row is history, not a second subscription: label it by why it
// was retired so it never reads as another active plan.
function statusBadge(sub: Subscription): { label: string; className: string } {
  const muted = "text-muted-foreground border-border bg-muted";
  const red = "text-red-500 border-red-500/30 bg-red-500/10";
  switch (sub.status) {
    case "active":
      return {
        label: "Active",
        className: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
      };
    case "expired":
      return { label: "Expired", className: red };
    case "revoked":
      return { label: "Revoked", className: red };
    case "superseded":
      return {
        label: sub.supersededReason === "upgrade" ? "Upgraded" : "Replaced",
        className: muted,
      };
  }
}

export default function SubscriptionPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"current" | "history">("current");
  const { data: subscription = [] } = useQuery({
    queryKey: ["admin", "user-subscriptions", view],
    queryFn: async (): Promise<Subscription[]> => {
      const rows = await getUserSubscriptions(view === "history");
      return rows.map((r) => ({
        id: r.id,
        accountId: r.accountId,
        name: r.name,
        email: r.email ?? "",
        phone: r.phone ?? "",
        group: r.group ?? "—",
        totalAds: r.totalAds,
        totalRenew: r.totalRenew,
        autoRenew: r.autoRenew,
        plan: r.plan ?? "—",
        price: Number(r.price),
        paymentMethod: r.paymentMethod ?? "—",
        subscribedAt: r.subscribedAt.slice(0, 10),
        expiredAt: r.expiresAt,
        status: r.status,
        supersededReason: r.supersededReason,
      }));
    },
  });
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["admin", "user-subscriptions"],
    });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState("all");

  // Grant dialog state + cascade
  const [isGrantOpen, setIsGrantOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [grant, setGrant] = useState({
    userId: "",
    categoryId: "",
    planId: "",
    packageId: "",
    termId: "",
    paymentMethod: "Bank",
  });
  const [granting, setGranting] = useState(false);

  const { data: userResults = { users: [] } } = useQuery({
    queryKey: ["admin", "users", "search", userQuery],
    queryFn: () => getAdminUsers({ q: userQuery, pageSize: 8 }),
    enabled: isGrantOpen,
  });
  const { data: grantCategories = [] } = useQuery({
    queryKey: ["admin", "sub", "categories"],
    queryFn: getSubCategories,
    enabled: isGrantOpen,
  });
  const { data: grantPlans = [] } = useQuery({
    queryKey: ["admin", "sub", "plans", grant.categoryId],
    queryFn: () => getSubPlans(grant.categoryId),
    enabled: isGrantOpen && !!grant.categoryId,
  });
  const { data: grantPackages = [] } = useQuery({
    queryKey: ["admin", "sub", "packages", grant.planId],
    queryFn: () => getSubPackages(grant.planId),
    enabled: isGrantOpen && !!grant.planId,
  });
  const { data: grantTerms = [] } = useQuery({
    queryKey: ["admin", "sub", "terms", grant.packageId],
    queryFn: () => getSubTerms(grant.packageId),
    enabled: isGrantOpen && !!grant.packageId,
  });

  const handleGrant = async () => {
    if (!grant.userId || !grant.termId) return;
    setGranting(true);
    const res = await grantSubscription({
      userId: grant.userId,
      termId: grant.termId,
      paymentMethod: grant.paymentMethod,
    });
    setGranting(false);
    if (res.success) {
      refresh();
      setIsGrantOpen(false);
      setGrant({
        userId: "",
        categoryId: "",
        planId: "",
        packageId: "",
        termId: "",
        paymentMethod: "Bank",
      });
      toast.success("Subscription granted");
    } else {
      toast.error(res.error);
    }
  };

  const filteredSubscriptions = subscription.filter((sub) => {
    const q = searchQuery.toLowerCase();

    const matchesSearch =
      sub.id.toLowerCase().includes(q) ||
      sub.accountId.toLowerCase().includes(q) ||
      sub.name.toLowerCase().includes(q) ||
      sub.email.toLowerCase().includes(q) ||
      sub.group.toLowerCase().includes(q);

    const matchesTab =
      tab === "all"
        ? true
        : tab === "auto"
          ? sub.group === "Auto"
          : tab === "food"
            ? sub.group === "Food"
            : tab === "general"
              ? sub.group === "General"
              : tab === "property"
                ? sub.group === "Property"
                : tab === "services"
                  ? sub.group === "Services"
                  : true;

    return matchesSearch && matchesTab;
  });

  const totalPages = Math.ceil(filteredSubscriptions.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedSubscriptions = filteredSubscriptions.slice(
    startIndex,
    startIndex + rowsPerPage,
  );
  const [revokeTarget, setRevokeTarget] = useState<Subscription | null>(null);
  const [revoking, setRevoking] = useState(false);
  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    const res = await revokeUserSubscription(revokeTarget.id);
    setRevoking(false);
    if (res.success) {
      refresh();
      setRevokeTarget(null);
      toast.success("Subscription revoked");
    } else {
      toast.error(res.error);
    }
  };

  return (
    <main className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="type-page-title text-sky-500">Users Subscription</h1>
          <p className="text-sm text-muted-foreground">
            Manage subscription plans and users
          </p>
          <div className="pt-3">
            <Button
              onClick={() => setIsGrantOpen(true)}
              className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer"
            >
              <Plus className="mr-2 size-4" />
              Grant Subscription
            </Button>
          </div>
          <div className="relative w-80 pt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground mt-2" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>
          <div className="pt-4">
            <Select
              value={view}
              onValueChange={(value) => {
                setView(value as "current" | "history");
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current subscriptions</SelectItem>
                <SelectItem value="history">Full history</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-6">
            <Tabs
              value={tab}
              onValueChange={(value) => {
                setTab(value);
                setCurrentPage(1);
              }}
            >
              <TabsList className="gap-1">
                <TabsTrigger value="all" className="cursor-pointer">
                  All Subscription
                </TabsTrigger>
                <TabsTrigger value="auto" className="cursor-pointer">
                  Auto
                  <Badge className="ml-1.5 px-1.5 py-0.5 type-meta">
                    {subscription.filter((s) => s.group === "Auto").length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="food" className="cursor-pointer">
                  Food
                  <Badge className="ml-1.5 px-1.5 py-0.5 type-meta">
                    {subscription.filter((s) => s.group === "Food").length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="general" className="cursor-pointer">
                  General
                  <Badge className="ml-1.5 px-1.5 py-0.5 type-meta">
                    {subscription.filter((s) => s.group === "General").length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="property" className="cursor-pointer">
                  Property
                  <Badge className="ml-1.5 px-1.5 py-0.5 type-meta">
                    {subscription.filter((s) => s.group === "Property").length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="services" className="cursor-pointer">
                  Services
                  <Badge className="ml-1.5 px-1.5 py-0.5 type-meta">
                    {subscription.filter((s) => s.group === "Services").length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>
      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Account ID</TableHead>
              <TableHead>Name / Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Total Ads</TableHead>
              <TableHead>Total Renew</TableHead>
              <TableHead>Auto Renew</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Subscribed</TableHead>
              <TableHead>Expired</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedSubscriptions.map((sub) => {
              const badge = statusBadge(sub);
              return (
                <TableRow key={sub.id}>
                  <TableCell>{sub.id}</TableCell>
                  <TableCell>{sub.accountId}</TableCell>

                  <TableCell>
                    <div>
                      <div className="font-medium">{sub.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {sub.email}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>{sub.phone}</TableCell>

                  <TableCell>
                    <Badge variant="outline">{sub.group}</Badge>
                  </TableCell>

                  <TableCell>{sub.totalAds}</TableCell>
                  <TableCell>{sub.totalRenew}</TableCell>
                  <TableCell>{sub.autoRenew}</TableCell>

                  <TableCell>{sub.plan}</TableCell>

                  <TableCell>${sub.price}</TableCell>

                  <TableCell>
                    <Badge variant="secondary">{sub.paymentMethod}</Badge>
                  </TableCell>

                  <TableCell>
                    {new Date(sub.subscribedAt).toLocaleDateString()}
                  </TableCell>

                  <TableCell>
                    {new Date(sub.expiredAt).toLocaleDateString()}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    {sub.status === "active" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="outline">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            className="text-destructive cursor-pointer"
                            onClick={() => setRevokeTarget(sub)}
                          >
                            Revoke
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t px-4 py-3">
          {/* Rows per page */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Rows per page
            <Select
              value={rowsPerPage.toString()}
              onValueChange={(value) => {
                setRowsPerPage(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="size-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="size-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="size-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
        {filteredSubscriptions.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            No subscriptions found
          </div>
        )}
      </div>

      {/* Grant Subscription dialog */}
      <Dialog open={isGrantOpen} onOpenChange={setIsGrantOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Grant Subscription</DialogTitle>
            <DialogDescription>
              Assign a subscription term to a user.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>User</Label>
              <Input
                placeholder="Search by name, phone or email..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
              />
              <Select
                value={grant.userId}
                onValueChange={(v) => setGrant({ ...grant, userId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {userResults.users.map((u) => (
                    <SelectItem key={u.userId} value={u.userId}>
                      {u.name} —{" "}
                      {u.networks[0] ?? u.email ?? u.userId.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={grant.categoryId}
                onValueChange={(v) =>
                  setGrant({
                    ...grant,
                    categoryId: v,
                    planId: "",
                    packageId: "",
                    termId: "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {grantCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Plan</Label>
              <Select
                value={grant.planId}
                onValueChange={(v) =>
                  setGrant({ ...grant, planId: v, packageId: "", termId: "" })
                }
                disabled={!grant.categoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {grantPlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Package</Label>
              <Select
                value={grant.packageId}
                onValueChange={(v) =>
                  setGrant({ ...grant, packageId: v, termId: "" })
                }
                disabled={!grant.planId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a package" />
                </SelectTrigger>
                <SelectContent>
                  {grantPackages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Term</Label>
              <Select
                value={grant.termId}
                onValueChange={(v) => setGrant({ ...grant, termId: v })}
                disabled={!grant.packageId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a term" />
                </SelectTrigger>
                <SelectContent>
                  {grantTerms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} — ${t.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Payment Method</Label>
              <Select
                value={grant.paymentMethod}
                onValueChange={(v) => setGrant({ ...grant, paymentMethod: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank">Bank</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Debit Card">Debit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-9 rounded-sm bg-red-500 text-white hover:bg-red-600 hover:text-white cursor-pointer"
              onClick={() => setIsGrantOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer"
              onClick={handleGrant}
              disabled={granting || !grant.userId || !grant.termId}
            >
              Grant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke subscription?</DialogTitle>
            <DialogDescription>
              {revokeTarget?.name}&apos;s {revokeTarget?.plan} plan ends now.
              The record stays in the history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-9 rounded-sm cursor-pointer"
              onClick={() => setRevokeTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="h-9 rounded-sm bg-red-500 text-white hover:bg-red-600 hover:text-white cursor-pointer"
              disabled={revoking}
              onClick={handleRevoke}
            >
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
