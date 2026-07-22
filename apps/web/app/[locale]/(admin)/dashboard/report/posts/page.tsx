"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IconLoader, IconCircleCheckFilled, IconCircleXFilled } from '@tabler/icons-react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from "lucide-react"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useRouter } from "@/i18n/routing"
import { ReportPost } from "@/types/reportpost"
import { reportPosts } from "@/lib/reportposts"
import { ReportPostReasons } from "@/lib/reportpostreasons"
import { posts } from "@/lib/posts"
import { Users } from "@/lib/users"
import { toSlug } from "@/lib/utils"


export default function ReportPostsPage() {

    const [reports, setReports] = useState<ReportPost[]>(reportPosts)
    const [searchQuery, setSearchQuery] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(50)
    const [tab, setTab] = useState("all")

    const updateStatus = (id: string, status: ReportPost["Status"]) => {
        setReports((prev) =>
            prev.map((r) =>
                r.ReportPostID === id ? { ...r, Status: status } : r
            )
        )
    }

    // ✅ SEARCH
    const filteredReports = reports.filter((r) => {
        const query = searchQuery.toLowerCase()

        const matchesSearch =
            r.ReportPostID.toLowerCase().includes(query) ||
            r.userId.toString().toLowerCase().includes(query) ||
            r.postId.toString().toLowerCase().includes(query) ||
            r.ReportReasonID.toString().toLowerCase().includes(query)

        const matchesTab =
            tab === "all" ||
            (tab === "pending" && r.Status === "Pending") ||
            (tab === "approved" && r.Status === "Approved") ||
            (tab === "rejected" && r.Status === "Rejected")

        return matchesSearch && matchesTab
    })

    const totalPages = Math.ceil(filteredReports.length / rowsPerPage)
    const paginatedReports = filteredReports.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    )
    const router = useRouter()
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
                            setTab(value)
                            setCurrentPage(1)
                        }}
                    >

                        <TabsList className="rounded-sm">
                            <TabsTrigger value="all" className="rounded-sm cursor-pointer">All Reports </TabsTrigger>
                            <TabsTrigger value="pending" className="rounded-sm cursor-pointer">
                                Pending
                                <Badge className="bg-blue-500 ml-1 text-xs text-white">
                                    {reports.filter((r) => r.Status === "Pending").length}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger value="approved" className="rounded-sm cursor-pointer">
                                Approved
                                <Badge className="bg-green-500  ml-1 text-xs text-white">
                                    {reports.filter((r) => r.Status === "Approved").length}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger value="rejected" className="rounded-sm cursor-pointer">
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
                            <TableHead>ReviewdBy</TableHead>
                            <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {paginatedReports.length === 0 ? (
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
                        {paginatedReports.map((report) => {
                            const user = Users.find(
                                (u) => u.userId === report.userId
                            )

                            const post = posts.find(
                                (p) => p.postId === report.postId
                            )

                            const reason = ReportPostReasons.find(
                                (r) => r.ReportReasonID === report.ReportReasonID
                            )

                            return (
                                <TableRow key={report.ReportPostID}>
                                    <TableCell className="text-center">{report.ReportPostID}</TableCell>
                                    <TableCell>
                                        {user?.username ?? "Unknown User"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="max-w-[150px] truncate">
                                            {post?.title ?? "Unknown Post"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {reason?.ReportReason ?? "Unknown Reason"}
                                    </TableCell>
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
                                            {report.Status === "Pending" && <IconLoader strokeWidth={1} className="w-3 h-3 animate-spin" />}
                                            {report.Status === "Approved" && <IconCircleCheckFilled strokeWidth={1} className="w-3 h-3 text-green-500" />}
                                            {report.Status === "Rejected" && <IconCircleXFilled strokeWidth={1} className="w-3 h-3 text-red-500 rounded-full" />}
                                            {report.Status}
                                        </Badge>
                                    </TableCell>

                                    <TableCell>{report.CreatedAt}</TableCell>

                                    <TableCell>
                                        {report.ReviewdBy ?? "-"}
                                    </TableCell>

                                    <TableCell className="flex gap-2 justify-center">
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                router.push({
                                                    pathname: "/[slug]",
                                                    params: {
                                                        slug: `${toSlug(post?.title ?? "")}-adid-${post?.postId}`,
                                                    },
                                                })
                                            }}
                                            className="text-white bg-yellow-500 rounded-sm hover:bg-yellow-600 hover:text-white cursor-pointer"
                                        >
                                            View
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() =>
                                                updateStatus(
                                                    report.ReportPostID,
                                                    "Approved"
                                                )
                                            }
                                            disabled={report.Status === "Approved"}
                                            className="text-white bg-green-500 rounded-sm hover:bg-green-600 hover:text-white cursor-pointer"
                                        >
                                            Approve
                                        </Button>

                                        <Button
                                            size="sm"
                                            onClick={() =>
                                                updateStatus(
                                                    report.ReportPostID,
                                                    "Rejected"
                                                )
                                            }
                                            disabled={report.Status === "Rejected"}
                                            className="text-white bg-red-500 rounded-sm hover:bg-red-600 hover:text-white cursor-pointer"
                                        >
                                            Reject
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        Rows per page
                        <Select
                            value={rowsPerPage.toString()}
                            onValueChange={(value) => {
                                setRowsPerPage(Number(value))
                                setCurrentPage(1)
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
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
        </div >
    )
}