"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import DbImage from "@/components/common/DbImage";
import {
  getAdminListings,
  removeListing,
  restoreListing,
  type AdminListingRow,
  type AdminListingsQuery,
} from "@/actions/admin-listings";

const PAGE_SIZE = 20;

/** Tabs → backend filters. "removed" = taken down by staff. */
const TABS: Record<string, Omit<AdminListingsQuery, "page" | "q">> = {
  all: {},
  active: { status: "active", moderated: false },
  restricted: { status: "restricted" },
  removed: { moderated: true },
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-500",
  draft: "bg-slate-400",
  expired: "bg-amber-500",
  restricted: "bg-orange-500",
  deleted: "bg-red-500",
};

export default function AdminListingsPage() {
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState<AdminListingRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const query: AdminListingsQuery = {
    ...TABS[tab],
    q: q || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  // Listings can run to thousands, so this page pages on the server rather
  // than filtering the full set client-side like the smaller admin tables.
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "listings", query],
    queryFn: () => getAdminListings(query),
    placeholderData: (prev) => prev,
  });
  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "listings"] });

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    const res = await removeListing(removing.id, reason);
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Listing removed");
    setRemoving(null);
    setReason("");
    refresh();
  };

  const restore = async (row: AdminListingRow) => {
    const res = await restoreListing(row.id);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Listing restored");
    refresh();
  };

  const viewHref = (row: AdminListingRow) =>
    `/${locale}/${encodeURIComponent(
      row.title.replace(/\s+/g, "-").toLowerCase(),
    )}-adid-${row.id}`;

  return (
    <div className="p-6">
      <div className="flex flex-col gap-1 mb-4">
        <h1 className="text-2xl text-sky-500 font-semibold">Listings</h1>
        <p className="text-sm text-muted-foreground">
          Review every ad and take down the ones that break the rules
        </p>
        <form
          className="relative max-w-sm mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(search.trim());
            setPage(1);
          }}
        >
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search titles… (Enter)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </form>
        <div className="mt-4">
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v);
              setPage(1);
            }}
          >
            <TabsList className="rounded-sm">
              <TabsTrigger value="all" className="rounded-sm cursor-pointer">
                All
              </TabsTrigger>
              <TabsTrigger value="active" className="rounded-sm cursor-pointer">
                Active
              </TabsTrigger>
              <TabsTrigger
                value="restricted"
                className="rounded-sm cursor-pointer"
              >
                Over plan limit
              </TabsTrigger>
              <TabsTrigger
                value="removed"
                className="rounded-sm cursor-pointer"
              >
                Removed
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Photo</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Open reports</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Search className="size-8" />
                    <p>{isLoading ? "Loading…" : "No listings found"}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="relative w-12 h-10 rounded overflow-hidden bg-muted">
                      {row.coverPhotoUrl && (
                        <DbImage
                          src={row.coverPhotoUrl}
                          alt={row.title}
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[220px] truncate font-medium">
                      {row.title}
                    </div>
                    {row.moderatedAt && (
                      <div className="max-w-[220px] truncate text-xs text-red-500">
                        Removed
                        {row.moderationReason
                          ? `: ${row.moderationReason}`
                          : ""}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{row.sellerUsername ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.categorySlug ?? "—"}
                    {row.subcategorySlug ? ` / ${row.subcategorySlug}` : ""}
                  </TableCell>
                  <TableCell>
                    {row.price === null
                      ? "Negotiable"
                      : `${row.currency === "USD" ? "$" : ""}${Number(row.price).toLocaleString()}`}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${STATUS_STYLE[row.status] ?? "bg-slate-400"} text-white capitalize`}
                    >
                      {row.moderatedAt ? "removed" : row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {row.pendingReports > 0 ? (
                      <Badge className="bg-red-500 text-white">
                        {row.pendingReports}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="flex gap-2 justify-center">
                    {!row.moderatedAt && (
                      <Button
                        size="sm"
                        asChild
                        className="text-white bg-yellow-500 rounded-sm hover:bg-yellow-600 hover:text-white cursor-pointer"
                      >
                        <a
                          href={viewHref(row)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>
                      </Button>
                    )}
                    {row.moderatedAt ? (
                      <Button
                        size="sm"
                        onClick={() => restore(row)}
                        className="text-white bg-green-500 rounded-sm hover:bg-green-600 cursor-pointer"
                      >
                        Restore
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setRemoving(row)}
                        className="text-white bg-red-500 rounded-sm hover:bg-red-600 cursor-pointer"
                      >
                        Remove
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {data?.total ?? 0} listings
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage(1)}
              disabled={page === 1}
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove listing</DialogTitle>
            <DialogDescription>
              &quot;{removing?.title}&quot; will be hidden everywhere and the
              seller won&apos;t be able to republish it. You can restore it
              later.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason (optional, visible to staff)"
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button
              className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 cursor-pointer"
              onClick={() => setRemoving(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={busy}
              className="h-9 rounded-sm bg-red-500 text-white hover:bg-red-600 cursor-pointer"
              onClick={confirmRemove}
            >
              {busy ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
