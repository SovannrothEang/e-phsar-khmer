"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Info,
  ListChecks,
  MoreVertical,
  Search,
  Trash2,
  Plus,
  Pencil,
} from "lucide-react";
import { getAdminSubcategories } from "@/actions/admin-subcategories";
import { SubscriptionScopeDialog } from "@/components/dashboard/subscription-scope-dialog";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { SubscriptionCategory } from "@/types/subscription";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import {
  getSubCategories,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
  type SubCategory,
} from "@/actions/admin-subscriptions";

function toVerbose(c: SubCategory): SubscriptionCategory {
  return {
    subscriptionCateId: c.id,
    subscriptioncatename: c.name,
    subscriptioncateslug: c.slug,
    desc: c.description ?? "",
    subscriptionplans: [],
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
  };
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

const emptyForm = {
  name: "",
  slug: "",
  desc: "",
};

export default function SubscriptionCategoryPage() {
  const queryClient = useQueryClient();
  const { data: rawCategories = [] } = useQuery({
    queryKey: ["admin", "sub", "categories"],
    queryFn: getSubCategories,
  });
  const subscriptionCategories = useMemo(
    () => rawCategories.map(toVerbose),
    [rawCategories],
  );
  const coverage = useMemo(
    () =>
      new Map(rawCategories.map((c) => [c.id, c.subcategoryIds?.length ?? 0])),
    [rawCategories],
  );
  const { data: allSubcategories = [] } = useQuery({
    queryKey: ["admin", "subcategories"],
    queryFn: getAdminSubcategories,
  });
  const uncovered = useMemo(() => {
    const covered = new Set(
      rawCategories.flatMap((c) => c.subcategoryIds ?? []),
    );
    return allSubcategories.filter((s) => !covered.has(s.subId)).length;
  }, [rawCategories, allSubcategories]);
  const [scopeGroupId, setScopeGroupId] = useState<string | null>(null);
  const scopeGroup = rawCategories.find((c) => c.id === scopeGroupId) ?? null;
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "sub", "categories"] });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<SubscriptionCategory | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const filteredSubscriptionCategories = subscriptionCategories.filter(
    (sub) => {
      const q = searchQuery.toLowerCase();

      const matchesSearch =
        sub.subscriptionCateId.toLowerCase().includes(q) ||
        sub.subscriptioncatename.toLowerCase().includes(q) ||
        sub.subscriptioncateslug.toLowerCase().includes(q) ||
        sub.desc.toLowerCase().includes(q) ||
        formatDate(sub.createdAt).toLowerCase().includes(q) ||
        formatDate(sub.updatedAt).toLowerCase().includes(q);

      return matchesSearch;
    },
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSubscriptionCategories.length / rowsPerPage),
  );
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedSubscriptionCategories = filteredSubscriptionCategories.slice(
    startIndex,
    startIndex + rowsPerPage,
  );

  const resetForm = () => setFormData(emptyForm);

  const handleAdd = async () => {
    const slug = formData.slug.trim() || slugify(formData.name);
    const res = await createSubCategory({
      name: formData.name.trim(),
      slug,
      description: formData.desc.trim(),
    });
    if (res.success) {
      refresh();
      resetForm();
      setIsAddDialogOpen(false);
      toast.success("Category created");
    } else {
      toast.error(res.error);
    }
  };

  const handleUpdate = async () => {
    if (!selectedCategory) return;
    const slug = formData.slug.trim() || slugify(formData.name);
    const res = await updateSubCategory(selectedCategory.subscriptionCateId, {
      name: formData.name.trim(),
      slug,
      description: formData.desc.trim(),
    });
    if (res.success) {
      refresh();
      resetForm();
      setSelectedCategory(null);
      setIsEditDialogOpen(false);
      toast.success("Category updated");
    } else {
      toast.error(res.error);
    }
  };

  const openEditDialog = (category: SubscriptionCategory) => {
    setSelectedCategory(category);
    setFormData({
      name: category.subscriptioncatename,
      slug: category.subscriptioncateslug,
      desc: category.desc,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (category: SubscriptionCategory) => {
    setSelectedCategory(category);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    const res = await deleteSubCategory(selectedCategory.subscriptionCateId);
    if (res.success) {
      refresh();
      toast.success("Category deleted");
    } else {
      toast.error(res.error);
    }
    setIsDeleteDialogOpen(false);
    setSelectedCategory(null);
  };

  const categoryFormFields = (idPrefix: string) => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name`}>Category name</Label>
        <Input
          id={`${idPrefix}-name`}
          placeholder="e.g. Auto"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-slug`}>Slug</Label>
        <Input
          id={`${idPrefix}-slug`}
          placeholder="e.g. auto"
          value={formData.slug}
          onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-desc`}>Description</Label>
        <Textarea
          id={`${idPrefix}-desc`}
          placeholder="Category description..."
          value={formData.desc}
          onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
          rows={4}
        />
      </div>
    </div>
  );

  const isFormValid = formData.name.trim().length > 0;

  return (
    <main className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="type-page-title text-sky-500">
            Subscription Categories
          </h1>
          <p className="type-body-sm text-muted-foreground">
            Manage subscription categories and their plans
          </p>
        </div>

        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="h-9 bg-sky-500 text-white rounded-sm hover:bg-sky-600 hover:text-white cursor-pointer">
              <Plus className="mr-2 size-4" />
              Add Subscription Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add subscription category</DialogTitle>
              <DialogDescription>
                Create a new subscription category. Plans can be added later.
              </DialogDescription>
            </DialogHeader>
            {categoryFormFields("add")}
            <DialogFooter>
              <Button
                className="h-9 bg-red-500 text-white rounded-sm hover:bg-red-600 cursor-pointer"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={!isFormValid}
                className="h-9 bg-sky-500 text-white rounded-sm hover:bg-sky-600 cursor-pointer"
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {uncovered > 0 && (
        <p className="flex items-center gap-2 rounded-md bg-sky-500/10 px-4 py-3 text-sm text-sky-800 dark:text-sky-300">
          <Info className="size-4 shrink-0" />
          {uncovered} listing{" "}
          {uncovered === 1 ? "subcategory is" : "subcategories are"} covered by
          no subscription category — ads posted there always use the free plan.
        </p>
      )}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-9"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">ID</TableHead>
              <TableHead className="text-center">Categories Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Covers</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSubscriptionCategories.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-10 text-muted-foreground"
                >
                  No subscription categories found
                </TableCell>
              </TableRow>
            ) : (
              paginatedSubscriptionCategories.map((sub) => (
                <TableRow key={sub.subscriptionCateId}>
                  <TableCell className="text-center">
                    {sub.subscriptionCateId}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{sub.subscriptioncatename}</Badge>
                  </TableCell>
                  <TableCell className="max-w-sm truncate">
                    {sub.desc}
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      type="button"
                      onClick={() => setScopeGroupId(sub.subscriptionCateId)}
                      className="cursor-pointer text-sky-600 hover:underline"
                    >
                      {coverage.get(sub.subscriptionCateId) ?? 0} subcategories
                    </button>
                  </TableCell>
                  <TableCell>{formatDate(sub.createdAt)}</TableCell>
                  <TableCell>{formatDate(sub.updatedAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          className="rounded-full cursor-pointer"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center">
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() =>
                            setScopeGroupId(sub.subscriptionCateId)
                          }
                        >
                          <ListChecks className="mr-2 size-4" />
                          Coverage
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-yellow-500 cursor-pointer"
                          onClick={() => openEditDialog(sub)}
                        >
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive cursor-pointer"
                          onClick={() => openDeleteDialog(sub)}
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

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            resetForm();
            setSelectedCategory(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit subscription category</DialogTitle>
            <DialogDescription>
              Update the category details. Existing plans are not changed.
            </DialogDescription>
          </DialogHeader>
          {categoryFormFields("edit")}
          <DialogFooter>
            <Button
              className="h-9 bg-red-500 hover:bg-red-600 text-white rounded-sm cursor-pointer"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-9 bg-sky-500 hover:bg-sky-600 text-white rounded-sm cursor-pointer"
              onClick={handleUpdate}
              disabled={!isFormValid}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {scopeGroup && (
        <SubscriptionScopeDialog
          key={scopeGroup.id}
          group={scopeGroup}
          groups={rawCategories}
          onClose={() => setScopeGroupId(null)}
          onSaved={refresh}
        />
      )}

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete subscription category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="text-foreground font-bold">
                {" "}
                &quot;{selectedCategory?.subscriptioncatename}&quot;
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="h-9 bg-red-500 hover:bg-red-600 text-white rounded-sm cursor-pointer"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-9 bg-sky-500 hover:bg-sky-600 text-white rounded-sm cursor-pointer"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
