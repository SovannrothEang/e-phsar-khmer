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
import { MoreVertical, Search, Trash2, Plus, Pencil } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  SubscriptionCategory,
  SubscriptionPackageOption,
} from "@/types/subscription";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import {
  getSubCategories,
  getSubPlans,
  getSubPackages,
  createSubPackage,
  updateSubPackage,
  deleteSubPackage,
  type SubCategory,
  type SubPackage,
} from "@/actions/admin-subscriptions";

type PackageTier = "Bronze" | "Siliver" | "Gold";

type PackageRow = SubscriptionPackageOption & {
  subscriptionCateId: string;
  categoryName: string;
  subscriptionPlanId: string;
  planName: string;
};

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString();
}

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

function toPackageRow(
  pkg: SubPackage,
  categoryId: string,
  categoryName: string,
  planName: string,
): PackageRow {
  return {
    SubscriptionPackageId: pkg.id,
    subscriptionPackagename: pkg.name,
    subscriptionPackagephoto: `Photos ${pkg.photos}`,
    subscriptionPackageads: `Ads ${pkg.ads}`,
    subscriptionPackagerenews: `Renews ${pkg.renews}`,
    subscriptionPackageautorenews: `Auto-Renews ${pkg.autoRenews}`,
    subscriptionPackagevideos: `Videos ${pkg.videos}`,
    subscriptionterm: [],
    createdAt: new Date(pkg.createdAt),
    updatedAt: new Date(pkg.updatedAt),
    subscriptionCateId: categoryId,
    categoryName,
    subscriptionPlanId: pkg.planId,
    planName,
  };
}

const emptyForm = {
  categoryId: "",
  planId: "",
  name: "",
  photo: "",
  ads: "",
  renews: "",
  autoRenews: "",
  videos: "",
};

export default function SubscriptionPackagePage() {
  const queryClient = useQueryClient();
  const { data: subscriptionCategories = [] } = useQuery({
    queryKey: ["admin", "sub", "categories"],
    queryFn: async () => (await getSubCategories()).map(toVerbose),
  });
  const { data: rawPlans = [] } = useQuery({
    queryKey: ["admin", "sub", "plans"],
    queryFn: () => getSubPlans(),
  });
  const { data: rawPackages = [] } = useQuery({
    queryKey: ["admin", "sub", "packages"],
    queryFn: () => getSubPackages(),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "sub", "packages"] });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageRow | null>(
    null,
  );
  const [formData, setFormData] = useState(emptyForm);

  const packageById = useMemo(
    () => new Map(rawPackages.map((p) => [p.id, p])),
    [rawPackages],
  );

  const allPackages = useMemo(() => {
    const catName = new Map(
      subscriptionCategories.map((c) => [
        c.subscriptionCateId,
        c.subscriptioncatename,
      ]),
    );
    const planInfo = new Map(
      rawPlans.map((p) => [p.id, { name: p.name, categoryId: p.categoryId }]),
    );
    return rawPackages.map((pkg) => {
      const pl = planInfo.get(pkg.planId);
      const categoryId = pl?.categoryId ?? "";
      return toPackageRow(
        pkg,
        categoryId,
        catName.get(categoryId) ?? "—",
        pl?.name ?? "—",
      );
    });
  }, [rawPackages, rawPlans, subscriptionCategories]);

  const plansForCategory = useMemo(
    () =>
      rawPlans
        .filter((p) => p.categoryId === formData.categoryId)
        .map((p) => ({
          subscriptionPlanId: p.id,
          subscriptionplanname: p.name,
        })),
    [rawPlans, formData.categoryId],
  );

  const filteredPackages = allPackages.filter((pkg) => {
    const q = searchQuery.toLowerCase();

    const matchesSearch =
      pkg.SubscriptionPackageId.toLowerCase().includes(q) ||
      pkg.subscriptionPackagename.toLowerCase().includes(q) ||
      pkg.subscriptionPackagephoto.toLowerCase().includes(q) ||
      pkg.subscriptionPackageads.toLowerCase().includes(q) ||
      pkg.subscriptionPackagerenews.toLowerCase().includes(q) ||
      pkg.subscriptionPackageautorenews.toLowerCase().includes(q) ||
      pkg.subscriptionPackagevideos.toLowerCase().includes(q) ||
      pkg.categoryName.toLowerCase().includes(q) ||
      pkg.planName.toLowerCase().includes(q) ||
      pkg.subscriptionCateId.toLowerCase().includes(q) ||
      pkg.subscriptionPlanId.toLowerCase().includes(q) ||
      formatDate(pkg.createdAt).toLowerCase().includes(q) ||
      formatDate(pkg.updatedAt).toLowerCase().includes(q);

    const matchesTab =
      tab === "all"
        ? true
        : tab === "bronze"
          ? pkg.subscriptionPackagename === "Bronze"
          : tab === "siliver"
            ? pkg.subscriptionPackagename === "Siliver"
            : tab === "gold"
              ? pkg.subscriptionPackagename === "Gold"
              : true;

    return matchesSearch && matchesTab;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPackages.length / rowsPerPage),
  );
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedPackages = filteredPackages.slice(
    startIndex,
    startIndex + rowsPerPage,
  );

  const resetForm = () => setFormData(emptyForm);

  const featureBody = () => ({
    name: formData.name.trim(),
    photos: Number(formData.photo) || 0,
    ads: Number(formData.ads) || 0,
    renews: Number(formData.renews) || 0,
    autoRenews: Number(formData.autoRenews) || 0,
    videos: Number(formData.videos) || 0,
  });

  const handleAdd = async () => {
    if (!formData.categoryId || !formData.planId) return;
    const res = await createSubPackage({
      planId: formData.planId,
      ...featureBody(),
    });
    if (res.success) {
      refresh();
      resetForm();
      setIsAddDialogOpen(false);
      toast.success("Package created");
    } else {
      toast.error(res.error);
    }
  };

  const handleUpdate = async () => {
    if (!selectedPackage || !formData.categoryId || !formData.planId) return;
    const res = await updateSubPackage(selectedPackage.SubscriptionPackageId, {
      planId: formData.planId,
      ...featureBody(),
    });
    if (res.success) {
      refresh();
      resetForm();
      setSelectedPackage(null);
      setIsEditDialogOpen(false);
      toast.success("Package updated");
    } else {
      toast.error(res.error);
    }
  };

  const openEditDialog = (pkg: PackageRow) => {
    setSelectedPackage(pkg);
    const raw = packageById.get(pkg.SubscriptionPackageId);
    setFormData({
      categoryId: pkg.subscriptionCateId,
      planId: pkg.subscriptionPlanId,
      name: pkg.subscriptionPackagename,
      photo: String(raw?.photos ?? 0),
      ads: String(raw?.ads ?? 0),
      renews: String(raw?.renews ?? 0),
      autoRenews: String(raw?.autoRenews ?? 0),
      videos: String(raw?.videos ?? 0),
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (pkg: PackageRow) => {
    setSelectedPackage(pkg);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedPackage) return;
    const res = await deleteSubPackage(selectedPackage.SubscriptionPackageId);
    if (res.success) {
      refresh();
      toast.success("Package deleted");
    } else {
      toast.error(res.error);
    }
    setIsDeleteDialogOpen(false);
    setSelectedPackage(null);
  };

  const packageFormFields = (idPrefix: string) => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-category`}>Category</Label>
        <Select
          value={formData.categoryId}
          onValueChange={(value) =>
            setFormData({ ...formData, categoryId: value, planId: "" })
          }
        >
          <SelectTrigger id={`${idPrefix}-category`}>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {subscriptionCategories.map((category) => (
              <SelectItem
                key={category.subscriptionCateId}
                value={category.subscriptionCateId}
              >
                {category.subscriptioncatename}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-plan`}>Plan</Label>
        <Select
          value={formData.planId}
          onValueChange={(value) => setFormData({ ...formData, planId: value })}
          disabled={!formData.categoryId}
        >
          <SelectTrigger id={`${idPrefix}-plan`}>
            <SelectValue placeholder="Select a plan" />
          </SelectTrigger>
          <SelectContent>
            {plansForCategory.map((plan) => (
              <SelectItem
                key={plan.subscriptionPlanId}
                value={plan.subscriptionPlanId}
              >
                {plan.subscriptionplanname}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name`}>Package name</Label>
        <Input
          id={`${idPrefix}-name`}
          placeholder="e.g. Bronze"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-photo`}>Photos</Label>
          <Input
            id={`${idPrefix}-photo`}
            type="number"
            min={0}
            placeholder="e.g. 24"
            value={formData.photo}
            onChange={(e) =>
              setFormData({ ...formData, photo: e.target.value })
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-ads`}>Ads</Label>
          <Input
            id={`${idPrefix}-ads`}
            type="number"
            min={0}
            placeholder="e.g. 30"
            value={formData.ads}
            onChange={(e) => setFormData({ ...formData, ads: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-renews`}>Renews</Label>
          <Input
            id={`${idPrefix}-renews`}
            type="number"
            min={0}
            placeholder="e.g. 10"
            value={formData.renews}
            onChange={(e) =>
              setFormData({ ...formData, renews: e.target.value })
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-autorenews`}>Auto-renews</Label>
          <Input
            id={`${idPrefix}-autorenews`}
            type="number"
            min={0}
            placeholder="e.g. 20"
            value={formData.autoRenews}
            onChange={(e) =>
              setFormData({ ...formData, autoRenews: e.target.value })
            }
          />
        </div>
        <div className="grid gap-2 col-span-2">
          <Label htmlFor={`${idPrefix}-videos`}>Videos</Label>
          <Input
            id={`${idPrefix}-videos`}
            type="number"
            min={0}
            placeholder="e.g. 10"
            value={formData.videos}
            onChange={(e) =>
              setFormData({ ...formData, videos: e.target.value })
            }
          />
        </div>
      </div>
    </div>
  );

  const getPackageBadge = (name: string) => {
    const tier = name as PackageTier;
    const colors: Record<PackageTier, string> = {
      Bronze: "text-foreground border-amber-950/30 bg-amber-950/10",
      Siliver: "text-slate-500 border-slate-500/30 bg-slate-500/10",
      Gold: "text-amber-500 border-amber-500/30 bg-amber-500/10",
    };
    const className = colors[tier] ?? "text-muted-foreground";
    return (
      <Badge variant="outline" className={className}>
        {name}
      </Badge>
    );
  };

  const countByTier = (tier: PackageTier) =>
    allPackages.filter((p) => p.subscriptionPackagename === tier).length;

  const isFormValid =
    formData.name.trim().length > 0 &&
    formData.categoryId.length > 0 &&
    formData.planId.length > 0;

  return (
    <main className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl text-sky-500 font-semibold">
            Subscription Packages
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage package limits and benefits under each plan
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
            <Button className="h-9 text-white bg-sky-500 rounded-sm hover:bg-sky-600 hover:text-white cursor-pointer">
              <Plus className="mr-2 size-4" />
              Add Package
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sky-500">
                Add subscription package
              </DialogTitle>
              <DialogDescription>
                Create a new package under a category and plan.
              </DialogDescription>
            </DialogHeader>
            {packageFormFields("add")}
            <DialogFooter>
              <Button
                className="h-9 bg-red-500 text-white rounded-sm hover:bg-red-600 hover:text-white cursor-pointer"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="h-9 text-white bg-sky-500 rounded-sm hover:bg-sky-600 hover:text-white cursor-pointer"
                onClick={handleAdd}
                disabled={!isFormValid}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative w-90">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search packages..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-9"
        />
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setCurrentPage(1);
        }}
      >
        <TabsList className="gap-1">
          <TabsTrigger value="all" className="cursor-pointer">
            All Packages
          </TabsTrigger>
          <TabsTrigger value="bronze" className="cursor-pointer">
            Bronze
            <Badge className="ml-1.5 px-1.5 py-0.5 text-xs text-foreground border-amber-950/30 bg-amber-950/10">
              {countByTier("Bronze")}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="siliver" className="cursor-pointer">
            Siliver
            <Badge className="ml-1.5 px-1.5 py-0.5 text-xs text-foreground border-slate-500/30 bg-slate-500/10">
              {countByTier("Siliver")}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="gold" className="cursor-pointer">
            Gold
            <Badge className="ml-1.5 px-1.5 py-0.5 text-xs text-foreground border-amber-500/30 bg-amber-500/10">
              {countByTier("Gold")}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">ID</TableHead>
              <TableHead className="text-center">Package</TableHead>
              <TableHead className="text-center">Category</TableHead>
              <TableHead className="text-center">Plan</TableHead>
              <TableHead>Photos</TableHead>
              <TableHead>Ads</TableHead>
              <TableHead>Renews</TableHead>
              <TableHead>Auto-Renews</TableHead>
              <TableHead>Videos</TableHead>
              <TableHead className="text-center">Terms</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPackages.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={13}
                  className="text-center py-10 text-muted-foreground"
                >
                  No subscription packages found
                </TableCell>
              </TableRow>
            ) : (
              paginatedPackages.map((pkg) => (
                <TableRow
                  key={`${pkg.subscriptionCateId}-${pkg.subscriptionPlanId}-${pkg.SubscriptionPackageId}`}
                >
                  <TableCell className="text-center">
                    {pkg.SubscriptionPackageId}
                  </TableCell>
                  <TableCell className="text-center">
                    {getPackageBadge(pkg.subscriptionPackagename)}
                  </TableCell>
                  <TableCell className="text-center">
                    {pkg.categoryName}
                  </TableCell>
                  <TableCell className="text-center">{pkg.planName}</TableCell>
                  <TableCell className="max-w-[120px] truncate text-sm">
                    {pkg.subscriptionPackagephoto}
                  </TableCell>
                  <TableCell className="max-w-[100px] truncate text-sm">
                    {pkg.subscriptionPackageads}
                  </TableCell>
                  <TableCell className="max-w-[100px] truncate text-sm">
                    {pkg.subscriptionPackagerenews}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate text-sm">
                    {pkg.subscriptionPackageautorenews}
                  </TableCell>
                  <TableCell className="max-w-[100px] truncate text-sm">
                    {pkg.subscriptionPackagevideos}
                  </TableCell>
                  <TableCell className="text-center">
                    {pkg.subscriptionterm.length}
                  </TableCell>
                  <TableCell>{formatDate(pkg.createdAt)}</TableCell>
                  <TableCell>{formatDate(pkg.updatedAt)}</TableCell>
                  <TableCell className="flex items-center justify-center">
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
                          className="text-yellow-500 cursor-pointer"
                          onClick={() => openEditDialog(pkg)}
                        >
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive cursor-pointer"
                          onClick={() => openDeleteDialog(pkg)}
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

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            resetForm();
            setSelectedPackage(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sky-500">
              Edit subscription package
            </DialogTitle>
            <DialogDescription>
              Update package limits or move it to another plan.
            </DialogDescription>
          </DialogHeader>
          {packageFormFields("edit")}
          <DialogFooter>
            <Button
              className="h-9 bg-red-500 text-white rounded-sm hover:bg-red-600 hover:text-white cursor-pointer"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-9 text-white bg-sky-500 rounded-sm hover:bg-sky-600 hover:text-white cursor-pointer"
              onClick={handleUpdate}
              disabled={!isFormValid}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete subscription package</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="text-red-500 font-bold">
                {selectedPackage?.subscriptionPackagename}
              </span>{" "}
              from category{" "}
              <span className="text-red-500 font-bold">
                {selectedPackage?.categoryName}
              </span>{" "}
              and plan{" "}
              <span className="text-red-500 font-bold">
                {selectedPackage?.planName}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="h-9 bg-red-500 text-white rounded-sm hover:bg-red-600 hover:text-white cursor-pointer"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-9 text-white bg-sky-500 rounded-sm hover:bg-sky-600 hover:text-white cursor-pointer"
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
