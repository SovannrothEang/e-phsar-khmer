"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import DbImage, { NoImageCell } from "@/components/common/DbImage";
import { ImageUpload } from "@/components/dashboard/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { getAdminCategories } from "@/actions/admin-categories";
import { getAdminSubcategories } from "@/actions/admin-subcategories";
import {
  getAdminAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  type AdminAttribute,
} from "@/actions/admin-attributes";

interface FormState {
  name: string;
  nameKm: string;
  slug: string;
  image: string;
  categoryId: string;
  subcategories: string[];
}

const EMPTY: FormState = {
  name: "",
  nameKm: "",
  slug: "",
  image: "",
  categoryId: "",
  subcategories: [],
};

/**
 * Generic admin CRUD table for any attribute-option `type`
 * (colors, rams, cpus, body types, …), backed by `/admin/attributes/:type`.
 */
export function AttributeManager({
  type,
  title,
  hasImage = false,
  readOnly = false,
}: {
  type: string;
  title: string;
  hasImage?: boolean;
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["admin", "attributes", type],
    queryFn: () => getAdminAttributes(type),
  });
  const { data: allCategories = [] } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: getAdminCategories,
  });
  const { data: allSubcategories = [] } = useQuery({
    queryKey: ["admin", "subcategories"],
    queryFn: getAdminSubcategories,
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "attributes", type] });

  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<AdminAttribute | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const availableSubcategories = allSubcategories.filter(
    (s) => s.categoryId === form.categoryId,
  );
  const toggleSub = (subId: string) =>
    setForm((prev) => ({
      ...prev,
      subcategories: prev.subcategories.includes(subId)
        ? prev.subcategories.filter((id) => id !== subId)
        : [...prev.subcategories, subId],
    }));

  const filtered = items.filter((i) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    const categoryName =
      allCategories.find((c) => c.cateId === i.categoryId)?.name ?? "";
    const subNames = i.subcategories
      .map((id) => allSubcategories.find((s) => s.subId === id)?.name ?? "")
      .join(" ");
    return (
      i.name.toLowerCase().includes(q) ||
      (i.nameKm ?? "").toLowerCase().includes(q) ||
      i.slug.toLowerCase().includes(q) ||
      categoryName.toLowerCase().includes(q) ||
      subNames.toLowerCase().includes(q)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated = filtered.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  const submit = async (id?: string) => {
    setSaving(true);
    const input = {
      name: form.name,
      nameKm: form.nameKm,
      slug: form.slug,
      image: hasImage ? form.image : undefined,
      categoryId: form.categoryId,
      subcategoryIds: form.subcategories,
    };
    const res = id
      ? await updateAttribute(type, id, input)
      : await createAttribute(type, input);
    setSaving(false);
    if (res.success) {
      refresh();
      setIsAddOpen(false);
      setIsEditOpen(false);
      toast.success(`${title} ${id ? "updated" : "created"}`);
    } else {
      toast.error(res.error ?? "Save failed");
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const res = await deleteAttribute(type, selected.id);
    if (res.success) {
      refresh();
      toast.success(`"${selected.name}" deleted`);
    } else {
      toast.error(res.error ?? "Delete failed");
    }
    setSelected(null);
    setIsDeleteOpen(false);
  };

  const openAdd = () => {
    setForm(EMPTY);
    setIsAddOpen(true);
  };
  const openEdit = (item: AdminAttribute) => {
    setSelected(item);
    setForm({
      name: item.name,
      nameKm: item.nameKm ?? "",
      slug: item.slug,
      image: item.image ?? "",
      categoryId: item.categoryId,
      subcategories: item.subcategories,
    });
    setIsEditOpen(true);
  };

  const fields = (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label>Name</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label>Khmer Name</Label>
        <Input
          value={form.nameKm}
          onChange={(e) => setForm({ ...form, nameKm: e.target.value })}
          placeholder="ឈ្មោះជាភាសាខ្មែរ"
        />
      </div>
      <div className="grid gap-2">
        <Label>Slug</Label>
        <Input
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />
      </div>
      {hasImage && (
        <div className="grid gap-2">
          <Label>Image</Label>
          <ImageUpload
            scope="attribute"
            value={form.image}
            onChange={(url) => setForm({ ...form, image: url })}
            label="Image"
          />
        </div>
      )}
      <div className="grid gap-2">
        <Label>Category</Label>
        <Select
          value={form.categoryId}
          onValueChange={(value) =>
            setForm({ ...form, categoryId: value, subcategories: [] })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {allCategories.map((cat) => (
                <SelectItem key={cat.cateId} value={cat.cateId}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Subcategories</Label>
        {!form.categoryId ? (
          <p className="text-sm text-muted-foreground border rounded-md px-3 py-2">
            Choose a category first
          </p>
        ) : availableSubcategories.length === 0 ? (
          <p className="text-sm text-muted-foreground border rounded-md px-3 py-2">
            No subcategories available
          </p>
        ) : (
          <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
            {availableSubcategories.map((sub) => (
              <label
                key={sub.subId}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
              >
                <Checkbox
                  checked={form.subcategories.includes(sub.subId)}
                  onCheckedChange={() => toggleSub(sub.subId)}
                />
                {sub.name}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <main className="flex-1 overflow-auto p-6 min-w-0">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-[#00a0e9] text-2xl font-semibold tracking-tight">
                {title}
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Manage {title} here.
              </p>
            </div>
            {readOnly ? (
              <p className="text-sm text-muted-foreground">
                Years are generated automatically (1980 –{" "}
                {new Date().getFullYear() + 1}) and cannot be edited.
              </p>
            ) : (
              <Button
                className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer"
                onClick={openAdd}
              >
                <Plus className="mr-2 size-4" />
                Add {title}
              </Button>
            )}
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                // Back to page 1 so a shrinking result set can't leave the
                // pagination pointing past the end (matches rowsPerPage reset).
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>

          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Khmer Name</TableHead>
                  <TableHead>Slug</TableHead>
                  {hasImage && <TableHead>Image</TableHead>}
                  <TableHead>Category</TableHead>
                  <TableHead>Sub Category</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={hasImage ? 9 : 8}
                      className="h-32 text-center"
                    >
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search className="size-8" />
                        <p>No {title} found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {item.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.nameKm ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.slug}
                      </TableCell>
                      {hasImage && (
                        <TableCell>
                          <DbImage
                            src={item.image ?? ""}
                            alt={item.name}
                            width={40}
                            height={40}
                            className="w-10 h-10 object-contain rounded border bg-muted/30 p-0.5"
                            fallback={<NoImageCell />}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        {allCategories.find(
                          (c) => c.cateId === item.categoryId,
                        ) && (
                          <span className="rounded bg-sky-200 px-2 py-1 text-sm text-black">
                            {
                              allCategories.find(
                                (c) => c.cateId === item.categoryId,
                              )?.name
                            }
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.subcategories.map((id) => {
                            const sub = allSubcategories.find(
                              (s) => s.subId === id,
                            );
                            return (
                              <span
                                key={id}
                                className="rounded bg-sky-100 px-2 py-1 text-sm text-black"
                              >
                                {sub?.name ?? id.slice(0, 8)}
                              </span>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.createdAt}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.updatedAt}
                      </TableCell>
                      <TableCell className="text-center">
                        {readOnly ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="rounded-full cursor-pointer"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center">
                              <DropdownMenuItem
                                className="text-orange-500 cursor-pointer"
                                onClick={() => openEdit(item)}
                              >
                                <Pencil className="mr-2 size-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive cursor-pointer"
                                onClick={() => {
                                  setSelected(item);
                                  setIsDeleteOpen(true);
                                }}
                              >
                                <Trash2 className="mr-2 size-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
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
        </div>
      </main>

      {/* Add / Edit dialogs share the same field set */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {title}</DialogTitle>
            <DialogDescription>Create a new entry.</DialogDescription>
          </DialogHeader>
          {fields}
          <DialogFooter>
            <Button
              variant="outline"
              className="h-9 rounded-sm bg-red-500 text-white hover:bg-red-600 hover:text-white cursor-pointer"
              onClick={() => setIsAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer"
              onClick={() => submit()}
              disabled={saving}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {title}</DialogTitle>
            <DialogDescription>Update the details.</DialogDescription>
          </DialogHeader>
          {fields}
          <DialogFooter>
            <Button
              variant="outline"
              className="h-9 rounded-sm bg-red-500 text-white hover:bg-red-600 hover:text-white cursor-pointer"
              onClick={() => setIsEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer"
              onClick={() => submit(selected?.id)}
              disabled={saving}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {title}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selected?.name}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-9 bg-sky-500 text-white rounded-sm hover:bg-sky-600 hover:text-white cursor-pointer"
              onClick={() => setIsDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className="h-9 bg-red-500 text-white rounded-sm hover:bg-red-600 hover:text-white cursor-pointer"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
