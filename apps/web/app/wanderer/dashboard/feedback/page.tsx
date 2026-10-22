"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Trash2, Search, MoreHorizontal } from "lucide-react";
import { Feedback } from "@/types/feedback";
import { deleteFeedback, getFeedbacks } from "@/actions/admin-feedback";
import { toast } from "@/components/ui/sonner";
import DbImage, { NoImageCell } from "@/components/common/DbImage";
import { formatPhoneLocal } from "@/lib/phone";

export default function FeedbackPage() {
  const queryClient = useQueryClient();
  const {
    data: feedbacks = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin", "feedback"],
    queryFn: async (): Promise<Feedback[]> => {
      const rows = await getFeedbacks();
      return rows.map((f) => ({
        FeedbackID: f.id,
        userId: f.userId ?? undefined,
        name: f.name,
        phone: f.phone,
        email: f.email ?? undefined,
        description: f.description,
        images: f.imageUrls,
        CreatedAt: f.createdAt,
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFeedback(id),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error ?? "Delete failed");
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["admin", "feedback"] });
      setSelectedFeedback(null);
      setIsDeleteDialogOpen(false);
      toast.success("Feedback deleted");
    },
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(
    null,
  );
  // The table clamps long descriptions; this opens the untruncated text.
  const [viewFeedback, setViewFeedback] = useState<Feedback | null>(null);

  const filteredFeedbacks = feedbacks.filter(
    (f) =>
      f.FeedbackID.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.phone.includes(searchQuery.toLowerCase()) ||
      (f.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.description || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredFeedbacks.length / rowsPerPage),
  );
  // Deleting the last row of the last page shrinks the set; clamp rather than
  // rendering an empty page until the pagination buttons are touched.
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * rowsPerPage;

  const paginatedFeedbacks = filteredFeedbacks.slice(
    startIndex,
    startIndex + rowsPerPage,
  );

  const handleDelete = () => {
    if (!selectedFeedback) return;
    deleteMutation.mutate(selectedFeedback.FeedbackID);
  };

  const openDeleteDialog = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="flex flex-col gap-1 mb-4">
        <h1 className="text-2xl text-sky-500 font-semibold">Feedbacks</h1>
        <p className="text-sm text-muted-foreground">
          Manage and review user feedbacks
        </p>
        <div className="relative max-w-sm mt-2">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search feedbacks..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1); // Reset page back to 1 when search filters change
            }}
            className="pl-9 h-10"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">ID</TableHead>
              <TableHead className="text-center">UserID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Image</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center py-6 text-muted-foreground"
                >
                  Loading feedbacks...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-6">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground py-6">
                    <p>Could not load feedbacks.</p>
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
            ) : paginatedFeedbacks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-6">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground py-6">
                    <p>No feedbacks found</p>
                    {searchQuery && (
                      <p className="text-sm">
                        No Search results for &quot;{searchQuery}&quot;
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedFeedbacks.map((feedback) => (
                <TableRow key={feedback.FeedbackID}>
                  <TableCell className="text-center">
                    {feedback.FeedbackID}
                  </TableCell>
                  <TableCell className="text-center">
                    {feedback.userId || "anonymous"}
                  </TableCell>
                  <TableCell className="max-w-[160px]">
                    <span
                      className="line-clamp-2 break-words"
                      title={feedback.name}
                    >
                      {feedback.name || "null"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {feedback.phone ? formatPhoneLocal(feedback.phone) : "null"}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <span
                      className="line-clamp-1 break-all"
                      title={feedback.email}
                    >
                      {feedback.email || "null"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center max-w-[200px]">
                    {feedback.images && feedback.images.length > 0 ? (
                      <div className="flex flex-wrap gap-1 justify-center max-h-[90px] overflow-y-auto p-0.5">
                        {feedback.images.slice(0, 24).map((image, index) => (
                          <DbImage
                            key={index}
                            src={image}
                            alt={`Feedback attachment ${index + 1}`}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded object-cover border border-muted cursor-pointer"
                            onClick={() => window.open(image, "_blank")}
                            fallback={<NoImageCell />}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[320px]">
                    <p
                      className="line-clamp-3 whitespace-pre-wrap break-words"
                      title={feedback.description}
                    >
                      {feedback.description}
                    </p>
                    {feedback.description.length > 140 && (
                      <button
                        type="button"
                        onClick={() => setViewFeedback(feedback)}
                        className="mt-1 text-xs text-sky-500 hover:underline cursor-pointer"
                      >
                        Read full text
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(feedback.CreatedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-full cursor-pointer"
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center">
                        <DropdownMenuItem
                          className="text-destructive cursor-pointer"
                          onClick={() => openDeleteDialog(feedback)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* PAGINATION */}
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
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setCurrentPage(1)}
                disabled={page === 1}
              >
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
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
                disabled={page === totalPages}
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setCurrentPage(totalPages)}
                disabled={page === totalPages}
              >
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Feedback</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{selectedFeedback?.name}
                &quot;? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="h-9 rounded-sm bg-red-500 text-white hover:bg-red-600 hover:text-white cursor-pointer"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Full text for a clamped description — the table stays scannable. */}
        <Dialog
          open={Boolean(viewFeedback)}
          onOpenChange={(open) => {
            if (!open) setViewFeedback(null);
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Feedback details</DialogTitle>
              <DialogDescription>
                {viewFeedback?.name}
                {viewFeedback
                  ? ` · ${formatPhoneLocal(viewFeedback.phone)}`
                  : ""}
                {viewFeedback?.email ? ` · ${viewFeedback.email}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words text-sm text-foreground">
              {viewFeedback?.description}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
