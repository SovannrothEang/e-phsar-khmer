"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  IconLoader,
  IconCircleCheckFilled,
  IconCircleXFilled,
} from "@tabler/icons-react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ReportPost } from "@/types/reportpost";
import {
  getListingReports,
  updateListingReportStatus,
} from "@/actions/admin-reports";
import { toast } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ReportPostRow = ReportPost & {
  _reporterName: string;
  _listingTitle: string;
};

export default function ReportPostsPage() {
  const queryClient = useQueryClient();
  const {
    data: reports = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin", "reports", "listings"],
    queryFn: async (): Promise<ReportPostRow[]> => {
      const rows = await getListingReports();
      return rows.map((r) => ({
        ReportPostID: r.id,
        postId: r.listingId,
        userId: r.reporterId,
        ReportReasonID: r.reasonText ?? "",
        ReportPostDescription: r.description ?? "",
        Status: (r.status.charAt(0).toUpperCase() +
          r.status.slice(1)) as ReportPost["Status"],
        CreatedAt: r.createdAt,
        ReviewedBy: r.reviewerName ?? undefined,
        _reporterName: r.reporterName,
        _listingTitle: r.listingTitle ?? "—",
      }));
    },
  });

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: "approved" | "rejected" }) =>
      updateListingReportStatus(input.id, input.status),
    onSuccess: (res, input) => {
      if (!res.success) {
        toast.error(res.error ?? "Update failed");
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: ["admin", "reports", "listings"],
      });
      toast.success(`Report ${input.status}`);
    },
  });

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [tab, setTab] = useState("all");

  // ✅ SEARCH
  const filteredReports = (reports as Array<ReportPostRow>).filter((r) => {
    const query = searchQuery.toLowerCase();

    const matchesSearch =
      r.ReportPostID.toLowerCase().includes(query) ||
      r.userId.toLowerCase().includes(query) ||
      String(r.postId).includes(query) ||
      (r._reporterName || "").toLowerCase().includes(query) ||
      (r._listingTitle || "").toLowerCase().includes(query) ||
      (r.ReportReasonID || "").toLowerCase().includes(query) ||
      (r.ReportPostDescription || "").toLowerCase().includes(query);

    const matchesTab =
      tab === "all" ||
      (tab === "pending" && r.Status === "Pending") ||
      (tab === "approved" && r.Status === "Approved") ||
      (tab === "rejected" && r.Status === "Rejected");

    return matchesSearch && matchesTab;
  });

  const totalPages = Math.ceil(filteredReports.length / rowsPerPage);
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );
  const router = useRouter();
  const locale = useLocale();
  return (
    <div className="p-6">
      <div className="flex flex-col gap-1 mb-4">
        <h1 className="text-2xl text-sky-500 font-semibold">Report Posts</h1>
        <p className="text-sm text-muted-foreground">
          Manage and review posts reports
        </p>
        <div className="relative max-w-sm mt-2">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        {/* Tabs */}
        <div className="mt-4">
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value);
              setCurrentPage(1);
            }}
          >
            <TabsList className="rounded-sm">
              <TabsTrigger value="all" className="rounded-sm cursor-pointer">
                All Reports{" "}
              </TabsTrigger>
              <TabsTrigger
                value="pending"
                className="rounded-sm cursor-pointer"
              >
                Pending
                <Badge className="bg-blue-500 ml-1 text-xs text-white">
                  {reports.filter((r) => r.Status === "Pending").length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="approved"
                className="rounded-sm cursor-pointer"
              >
                Approved
                <Badge className="bg-green-500  ml-1 text-xs text-white">
                  {reports.filter((r) => r.Status === "Approved").length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="rejected"
                className="rounded-sm cursor-pointer"
              >
                Rejected
                <Badge className="bg-red-500 ml-1 text-xs text-white">
                  {reports.filter((r) => r.Status === "Rejected").length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Report ID</TableHead>
              <TableHead>Reported By</TableHead>
              <TableHead>Target Post</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>ReviewedBy</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-muted-foreground"
                >
                  Loading reports…
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <p>Could not load reports.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void refetch()}
                    >
                      Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Search className="size-8" />
                    <p>No Report found</p>
                    {searchQuery && (
                      <p className="text-sm">
                        No Search results for &quot;{searchQuery}&quot;
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
            {(paginatedReports as Array<ReportPostRow>).map((report) => {
              const reporterName =
                (report as ReportPostRow)._reporterName || "—";
              const listingTitle =
                (report as ReportPostRow)._listingTitle || "—";
              return (
                <TableRow key={report.ReportPostID}>
                  <TableCell className="text-center">
                    {report.ReportPostID}
                  </TableCell>
                  <TableCell>{reporterName}</TableCell>
                  <TableCell>
                    <div className="max-w-[150px] truncate">{listingTitle}</div>
                  </TableCell>
                  <TableCell>{report.ReportReasonID || "—"}</TableCell>
                  <TableCell className="truncate">
                    {report.ReportPostDescription}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        report.Status === "Approved"
                          ? "outline"
                          : report.Status === "Rejected"
                            ? "outline"
                            : "outline"
                      }
                      className="flex items-center"
                    >
                      {report.Status === "Pending" && (
                        <IconLoader
                          strokeWidth={1}
                          className="w-3 h-3 animate-spin"
                        />
                      )}
                      {report.Status === "Approved" && (
                        <IconCircleCheckFilled
                          strokeWidth={1}
                          className="w-3 h-3 text-green-500"
                        />
                      )}
                      {report.Status === "Rejected" && (
                        <IconCircleXFilled
                          strokeWidth={1}
                          className="w-3 h-3 text-red-500 rounded-full"
                        />
                      )}
                      {report.Status}
                    </Badge>
                  </TableCell>

                  <TableCell>{report.CreatedAt}</TableCell>

                  <TableCell>{report.ReviewedBy ?? "-"}</TableCell>

                  <TableCell className="flex gap-2 justify-center">
                    <Button
                      size="sm"
                      onClick={() => {
                        router.push(
                          `/${locale}/${listingTitle.replace(/\s+/g, "-").toLowerCase()}-adid-${report.postId}`,
                        );
                      }}
                      className="text-white bg-yellow-500 rounded-sm hover:bg-yellow-600 hover:text-white cursor-pointer"
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setConfirmId(report.ReportPostID)}
                      disabled={
                        report.Status === "Approved" || statusMutation.isPending
                      }
                      className="text-white bg-green-500 rounded-sm hover:bg-green-600 hover:text-white cursor-pointer"
                    >
                      Approve
                    </Button>

                    <Button
                      size="sm"
                      onClick={() =>
                        statusMutation.mutate({
                          id: report.ReportPostID,
                          status: "rejected",
                        })
                      }
                      disabled={
                        report.Status === "Rejected" || statusMutation.isPending
                      }
                      className="text-white bg-red-500 rounded-sm hover:bg-red-600 hover:text-white cursor-pointer"
                    >
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Rows per page
            <Select
              value={rowsPerPage.toString()}
              onValueChange={(value) => {
                setRowsPerPage(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[80px]">
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
      </div>

      <Dialog
        open={confirmId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve this report?</DialogTitle>
            <DialogDescription>
              The listing is removed from the marketplace immediately. Rejecting
              the report later will not restore it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmId(null)}>
              Cancel
            </Button>
            <Button
              className="bg-green-500 text-white hover:bg-green-600"
              onClick={() => {
                if (confirmId)
                  statusMutation.mutate({
                    id: confirmId,
                    status: "approved",
                  });
                setConfirmId(null);
              }}
            >
              Approve and take down
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
