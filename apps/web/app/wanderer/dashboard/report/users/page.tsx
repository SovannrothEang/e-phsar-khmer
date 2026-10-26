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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  IconLoader,
  IconCircleCheckFilled,
  IconCircleXFilled,
} from "@tabler/icons-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUserReports,
  updateUserReportStatus,
} from "@/actions/admin-reports";
import { ReportUser } from "@/types/reportuser";
import { toast } from "@/components/ui/sonner";

type ReportUserRow = ReportUser & {
  _reporterName: string;
  _targetName: string;
};

export default function ReportUsersPage() {
  const queryClient = useQueryClient();
  const { data: reports = [] } = useQuery({
    queryKey: ["admin", "reports", "users"],
    queryFn: async (): Promise<ReportUser[]> => {
      const rows = await getUserReports();
      return rows.map(
        (r) =>
          ({
            ReportUserID: r.id,
            TargetUserID: r.targetUserId,
            ReportedByUserID: r.reporterId,
            // Storage paths are not URLs — render the backend's public URLs.
            ReportImage: r.imageUrls ?? [],
            ReportReasonID: r.reasonText ?? "",
            ReportUserDescription: r.description ?? "",
            Status: (r.status.charAt(0).toUpperCase() +
              r.status.slice(1)) as ReportUser["Status"],
            CreatedAt: r.createdAt,
            ReviewedBy: r.reviewedById ?? undefined,
            _reporterName: r.reporterName,
            _targetName: r.targetName,
          }) as ReportUserRow,
      );
    },
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "reports", "users"] });

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [tab, setTab] = useState("all");
  const router = useRouter();
  const locale = useLocale();

  const updateStatus = async (id: string, status: ReportUser["Status"]) => {
    if (
      status === "Approved" &&
      !window.confirm("Approving suspends this account. Continue?")
    )
      return;
    const s = status.toLowerCase() as "pending" | "approved" | "rejected";
    const res = await updateUserReportStatus(id, s);
    if (res.success) {
      refresh();
      toast.success(`Report ${status}`);
    } else {
      toast.error(res.error ?? "Update failed");
    }
  };

  // ✅ SEARCH & FILTER
  const filteredReports = (reports as Array<ReportUserRow>).filter((r) => {
    const query = searchQuery.toLowerCase().trim();

    const matchesSearch =
      r.ReportUserID.toLowerCase().includes(query) ||
      r.ReportedByUserID.toLowerCase().includes(query) ||
      (r.TargetUserID || "").toLowerCase().includes(query) ||
      (r._reporterName || "").toLowerCase().includes(query) ||
      (r._targetName || "").toLowerCase().includes(query) ||
      (r.ReportReasonID || "").toLowerCase().includes(query) ||
      (r.ReportUserDescription || "").toLowerCase().includes(query);

    const matchesTab =
      tab === "all" ||
      (tab === "pending" && r.Status === "Pending") ||
      (tab === "approved" && r.Status === "Approved") ||
      (tab === "rejected" && r.Status === "Rejected");

    return matchesSearch && matchesTab;
  });

  // ✅ PAGINATION (AFTER FILTER)
  const totalPages = Math.ceil(filteredReports.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;

  const paginatedReports = filteredReports.slice(
    startIndex,
    startIndex + rowsPerPage,
  );

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="flex flex-col gap-1 mb-4">
        <h1 className="type-page-title text-sky-500">Report Users</h1>
        <p className="type-body-sm text-muted-foreground">
          Manage and review user reports
        </p>

        <div className="relative max-w-sm mt-2">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Search for reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
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
                <Badge className="bg-blue-500 ml-1 text-white">
                  {reports.filter((r) => r.Status === "Pending").length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="approved"
                className="rounded-sm cursor-pointer"
              >
                Approved
                <Badge className="bg-green-500  ml-1 text-white">
                  {reports.filter((r) => r.Status === "Approved").length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="rejected"
                className="rounded-sm cursor-pointer"
              >
                Rejected
                <Badge className="bg-red-500 ml-1 text-white">
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
              <TableHead className="text-center">Report ID</TableHead>
              <TableHead className="text-center">Reported By</TableHead>
              <TableHead className="text-center">Target User</TableHead>
              <TableHead>Image</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>ReviewdBy</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground py-6">
                    <p>No reports found</p>
                    {searchQuery && (
                      <p className="type-body-sm">
                        No results for &quot;{searchQuery}&quot;
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
            {(paginatedReports as Array<ReportUserRow>).map((report) => {
              const reporterName =
                (report as ReportUserRow)._reporterName || "—";
              const targetName = (report as ReportUserRow)._targetName || "—";
              return (
                <TableRow key={report.ReportUserID}>
                  <TableCell className="text-center">
                    {report.ReportUserID}
                  </TableCell>
                  <TableCell className="text-center">{reporterName}</TableCell>
                  <TableCell className="text-center">{targetName}</TableCell>
                  <TableCell className="text-center max-w-[200px]">
                    {report.ReportImage && report.ReportImage.length > 0 ? (
                      <div className="flex flex-wrap gap-1 justify-center max-h-[90px] overflow-y-auto p-0.5">
                        {report.ReportImage.slice(0, 24).map((image, index) => (
                          // eslint-disable-next-line @next/next/no-img-element -- dynamic attachment URL
                          <img
                            key={index}
                            src={image}
                            alt={`Report attachment ${index + 1}`}
                            className="w-10 h-10 rounded object-cover border border-muted cursor-pointer"
                            onClick={() => window.open(image, "_blank")}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{report.ReportReasonID || "—"}</TableCell>
                  <TableCell>{report.ReportUserDescription}</TableCell>
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
                  <TableCell>{report.CreatedAt.toLocaleString()}</TableCell>
                  <TableCell>{report.ReviewedBy ?? "-"}</TableCell>
                  <TableCell className="flex gap-2 justify-center">
                    <Button
                      size="sm"
                      onClick={() => {
                        const slug =
                          (report as ReportUserRow)._targetName
                            ?.replace(/\s+/g, "-")
                            .toLowerCase() + report.TargetUserID;
                        router.push(`/${locale}/${slug}`);
                      }}
                      className="text-white bg-yellow-500 rounded-sm hover:bg-yellow-600 hover:text-white cursor-pointer"
                    >
                      View Profile
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        updateStatus(report.ReportUserID, "Approved")
                      }
                      disabled={report.Status === "Approved"}
                      className="text-white bg-green-500 rounded-sm hover:bg-green-600 hover:text-white cursor-pointer"
                    >
                      Approve
                    </Button>

                    <Button
                      size="sm"
                      onClick={() =>
                        updateStatus(report.ReportUserID, "Rejected")
                      }
                      disabled={report.Status === "Rejected"}
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

        {/* PAGINATION */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="flex items-center gap-2 type-body-sm text-muted-foreground">
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
            <span className="type-body-sm text-muted-foreground">
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
    </div>
  );
}
