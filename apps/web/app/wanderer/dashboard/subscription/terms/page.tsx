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
import {
  Filter,
  MoreVertical,
  Search,
  Trash2,
  Plus,
  Pencil,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import {
  SubscriptionCategory,
  SubscriptionTermDiscountType,
  SubscriptionTermDurationUnit,
  SubscriptionTermOption,
} from "@/types/subscription";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import {
  getSubCategories,
  getSubPlans,
  getSubPackages,
  getSubTerms,
  createSubTerm,
  updateSubTerm,
  deleteSubTerm,
  type SubCategory,
  type SubTerm,
} from "@/actions/admin-subscriptions";

type TermRow = SubscriptionTermOption & {
  subscriptionCateId: string;
  categoryName: string;
  subscriptionPlanId: string;
  planName: string;
  SubscriptionPackageId: string;
  packageName: string;
};

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString();
}

function formatPrice(amount: number) {
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function calcFinalPrice(
  price: number,
  discount: number,
  type: SubscriptionTermDiscountType,
): number {
  if (discount <= 0 || price <= 0) return price;
  if (type === "percent") {
    const pct = Math.min(100, Math.max(0, discount));
    return Math.max(0, price * (1 - pct / 100));
  }
  return Math.max(0, price - discount);
}

function formatDiscountDisplay(
  discount: number,
  type: SubscriptionTermDiscountType,
): string {
  if (discount <= 0) return "—";
  return type === "percent" ? `${discount}%` : formatPrice(discount);
}

function normalizeDiscountType(
  type: SubscriptionTermDiscountType | undefined,
): SubscriptionTermDiscountType {
  return type === "percent" ? "percent" : "amount";
}

function formatDuration(value: number, unit: SubscriptionTermDurationUnit) {
  const unitLabel =
    unit === "day" ? "Day" : unit === "month" ? "Month" : "Year";
  const plural = value === 1 ? "" : "s";
  return `${value} ${unitLabel}${plural}`;
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

function toTermRow(
  t: SubTerm,
  ctx: {
    categoryId: string;
    categoryName: string;
    planId: string;
    planName: string;
    packageName: string;
  },
): TermRow {
  return {
    SubscriptionTermId: t.id,
    subscriptiontermname: t.name,
    subscriptiontermdurationvalue: t.durationValue,
    subscriptiontermdurationunit: t.durationUnit,
    subscriptiontermprice: Number(t.price),
    subscriptiontermdiscount: Number(t.discount),
    subscriptiontermdiscounttype: t.discountType,
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt),
    subscriptionCateId: ctx.categoryId,
    categoryName: ctx.categoryName,
    subscriptionPlanId: ctx.planId,
    planName: ctx.planName,
    SubscriptionPackageId: t.packageId,
    packageName: ctx.packageName,
  };
}

const emptyForm = {
  categoryId: "",
  planId: "",
  packageId: "",
  durationValue: "",
  durationUnit: "month" as SubscriptionTermDurationUnit,
  name: "",
  price: "",
  discount: "",
  discountType: "amount" as SubscriptionTermDiscountType,
};

export default function SubscriptionTermPage() {
  const queryClient = useQueryClient();
  // Cache the raw rows: this key is shared with the categories page, which
  // reads `id`/`subcategoryIds`. Mapping here would hand that page the wrong
  // shape (its toVerbose would yield undefined ids).
  const { data: rawCategories = [] } = useQuery({
    queryKey: ["admin", "sub", "categories"],
    queryFn: () => getSubCategories(),
  });
  const subscriptionCategories = useMemo(
    () => rawCategories.map(toVerbose),
    [rawCategories],
  );
  const { data: rawPlans = [] } = useQuery({
    queryKey: ["admin", "sub", "plans"],
    queryFn: () => getSubPlans(),
  });
  const { data: rawPackages = [] } = useQuery({
    queryKey: ["admin", "sub", "packages"],
    queryFn: () => getSubPackages(),
  });
  const { data: rawTerms = [] } = useQuery({
    queryKey: ["admin", "sub", "terms"],
    queryFn: () => getSubTerms(),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "sub", "terms"] });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [durationFilter, setDurationFilter] = useState("__all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<TermRow | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const allTerms = useMemo(() => {
    const catName = new Map(
      subscriptionCategories.map((c) => [
        c.subscriptionCateId,
        c.subscriptioncatename,
      ]),
    );
    const planInfo = new Map(
      rawPlans.map((p) => [p.id, { name: p.name, categoryId: p.categoryId }]),
    );
    const pkgInfo = new Map(
      rawPackages.map((p) => [p.id, { name: p.name, planId: p.planId }]),
    );
    return rawTerms.map((t) => {
      const pkg = pkgInfo.get(t.packageId);
      const plan = pkg ? planInfo.get(pkg.planId) : undefined;
      const categoryId = plan?.categoryId ?? "";
      return toTermRow(t, {
        categoryId,
        categoryName: catName.get(categoryId) ?? "—",
        planId: pkg?.planId ?? "",
        planName: plan?.name ?? "—",
        packageName: pkg?.name ?? "—",
      });
    });
  }, [rawTerms, rawPackages, rawPlans, subscriptionCategories]);

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

  const packagesForPlan = useMemo(
    () =>
      rawPackages
        .filter((p) => p.planId === formData.planId)
        .map((p) => ({
          SubscriptionPackageId: p.id,
          subscriptionPackagename: p.name,
        })),
    [rawPackages, formData.planId],
  );

  const durationOptions = Array.from(
    new Map(
      allTerms.map((term) => {
        const value = term.subscriptiontermdurationvalue;
        const unit = term.subscriptiontermdurationunit;
        return [
          `${value}:${unit}`,
          { value, unit, label: formatDuration(value, unit) },
        ];
      }),
    ).values(),
  ).sort((a, b) => {
    const unitOrder: Record<SubscriptionTermDurationUnit, number> = {
      day: 0,
      month: 1,
      year: 2,
    };
    return unitOrder[a.unit] - unitOrder[b.unit] || a.value - b.value;
  });

  const filteredTerms = allTerms.filter((term) => {
    const q = searchQuery.toLowerCase();

    const matchesSearch =
      term.SubscriptionTermId.toLowerCase().includes(q) ||
      term.subscriptiontermname.toLowerCase().includes(q) ||
      String(term.subscriptiontermprice).includes(q) ||
      String(term.subscriptiontermdiscount).includes(q) ||
      term.categoryName.toLowerCase().includes(q) ||
      term.planName.toLowerCase().includes(q) ||
      term.packageName.toLowerCase().includes(q) ||
      term.subscriptionCateId.toLowerCase().includes(q) ||
      term.subscriptionPlanId.toLowerCase().includes(q) ||
      term.SubscriptionPackageId.toLowerCase().includes(q) ||
      formatDate(term.createdAt).toLowerCase().includes(q) ||
      formatDate(term.updatedAt).toLowerCase().includes(q);

    const matchesFilter =
      durationFilter === "__all" ||
      `${term.subscriptiontermdurationvalue}:${term.subscriptiontermdurationunit}` ===
        durationFilter;

    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTerms.length / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedTerms = filteredTerms.slice(
    startIndex,
    startIndex + rowsPerPage,
  );

  const resetForm = () => setFormData(emptyForm);

  const termBody = () => {
    const durationValue = Number(formData.durationValue) || 1;
    const durationUnit = formData.durationUnit || "month";
    return {
      name: formData.name.trim() || formatDuration(durationValue, durationUnit),
      durationValue,
      durationUnit,
      price: Number(formData.price) || 0,
      discount: Number(formData.discount) || 0,
      discountType: formData.discountType,
    };
  };

  const handleAdd = async () => {
    if (!formData.categoryId || !formData.planId || !formData.packageId) return;
    const res = await createSubTerm({
      packageId: formData.packageId,
      ...termBody(),
    });
    if (res.success) {
      refresh();
      resetForm();
      setIsAddDialogOpen(false);
      toast.success("Term created");
    } else {
      toast.error(res.error);
    }
  };

  const handleUpdate = async () => {
    if (
      !selectedTerm ||
      !formData.categoryId ||
      !formData.planId ||
      !formData.packageId
    )
      return;
    const res = await updateSubTerm(selectedTerm.SubscriptionTermId, {
      packageId: formData.packageId,
      ...termBody(),
    });
    if (res.success) {
      refresh();
      resetForm();
      setSelectedTerm(null);
      setIsEditDialogOpen(false);
      toast.success("Term updated");
    } else {
      toast.error(res.error);
    }
  };

  const openEditDialog = (term: TermRow) => {
    setSelectedTerm(term);
    setFormData({
      categoryId: term.subscriptionCateId,
      planId: term.subscriptionPlanId,
      packageId: term.SubscriptionPackageId,
      durationValue: String(term.subscriptiontermdurationvalue),
      durationUnit: term.subscriptiontermdurationunit,
      name: term.subscriptiontermname,
      price: String(term.subscriptiontermprice),
      discount: String(term.subscriptiontermdiscount),
      discountType: normalizeDiscountType(term.subscriptiontermdiscounttype),
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (term: TermRow) => {
    setSelectedTerm(term);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedTerm) return;
    const res = await deleteSubTerm(selectedTerm.SubscriptionTermId);
    if (res.success) {
      refresh();
      toast.success("Term deleted");
    } else {
      toast.error(res.error);
    }
    setIsDeleteDialogOpen(false);
    setSelectedTerm(null);
  };

  const formPrice = Number(formData.price) || 0;
  const formDiscount = Number(formData.discount) || 0;
  const formFinalPrice = calcFinalPrice(
    formPrice,
    formDiscount,
    formData.discountType,
  );

  const termFormFields = (idPrefix: string) => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-category`}>Category</Label>
        <Select
          value={formData.categoryId}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              categoryId: value,
              planId: "",
              packageId: "",
            })
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
          onValueChange={(value) =>
            setFormData({ ...formData, planId: value, packageId: "" })
          }
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
        <Label htmlFor={`${idPrefix}-package`}>Package</Label>
        <Select
          value={formData.packageId}
          onValueChange={(value) =>
            setFormData({ ...formData, packageId: value })
          }
          disabled={!formData.planId}
        >
          <SelectTrigger id={`${idPrefix}-package`}>
            <SelectValue placeholder="Select a package" />
          </SelectTrigger>
          <SelectContent>
            {packagesForPlan.map((pkg) => (
              <SelectItem
                key={pkg.SubscriptionPackageId}
                value={pkg.SubscriptionPackageId}
              >
                {pkg.subscriptionPackagename}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-duration-value`}>Duration</Label>
          <Input
            id={`${idPrefix}-duration-value`}
            type="number"
            min={1}
            step={1}
            placeholder="e.g. 6"
            value={formData.durationValue}
            onChange={(e) =>
              setFormData({ ...formData, durationValue: e.target.value })
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-duration-unit`}>Duration unit</Label>
          <Select
            value={formData.durationUnit}
            onValueChange={(value: SubscriptionTermDurationUnit) =>
              setFormData({ ...formData, durationUnit: value })
            }
          >
            <SelectTrigger id={`${idPrefix}-duration-unit`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Days</SelectItem>
              <SelectItem value="month">Months</SelectItem>
              <SelectItem value="year">Years</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name`}>Term name (optional)</Label>
        <Input
          id={`${idPrefix}-name`}
          placeholder={formatDuration(
            Number(formData.durationValue) || 1,
            formData.durationUnit,
          )}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Leave blank to use the duration as the term name.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-price`}>Price ($)</Label>
        <Input
          id={`${idPrefix}-price`}
          type="number"
          min={0}
          step="0.01"
          placeholder="e.g. 100"
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-discount-type`}>Discount type</Label>
          <Select
            value={formData.discountType}
            onValueChange={(value: SubscriptionTermDiscountType) =>
              setFormData({
                ...formData,
                discountType: value,
              })
            }
          >
            <SelectTrigger id={`${idPrefix}-discount-type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="amount">$ (fixed amount)</SelectItem>
              <SelectItem value="percent">% (percentage)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-discount`}>
            Discount {formData.discountType === "percent" ? "(%)" : "($)"}
          </Label>
          <Input
            id={`${idPrefix}-discount`}
            type="number"
            min={0}
            max={formData.discountType === "percent" ? 100 : undefined}
            step={formData.discountType === "percent" ? 1 : "0.01"}
            placeholder={
              formData.discountType === "percent" ? "e.g. 10" : "e.g. 20"
            }
            value={formData.discount}
            onChange={(e) =>
              setFormData({ ...formData, discount: e.target.value })
            }
          />
        </div>
      </div>
      {formPrice > 0 && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Final price: </span>
          <span className="font-semibold">{formatPrice(formFinalPrice)}</span>
          {formDiscount > 0 && (
            <span className="text-muted-foreground">
              {" "}
              ({formatPrice(formPrice)} −{" "}
              {formatDiscountDisplay(formDiscount, formData.discountType)})
            </span>
          )}
        </div>
      )}
    </div>
  );

  const getDurationBadge = (
    value: number,
    unit: SubscriptionTermDurationUnit,
  ) => <Badge variant="outline">{formatDuration(value, unit)}</Badge>;

  const getPackageBadge = (name: string) => (
    <Badge variant="outline">{name}</Badge>
  );

  const durationValue = Number(formData.durationValue);
  const isFormValid =
    formData.categoryId.length > 0 &&
    formData.planId.length > 0 &&
    formData.packageId.length > 0 &&
    Number.isInteger(durationValue) &&
    durationValue > 0 &&
    formData.price.trim().length > 0;

  return (
    <main className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="type-page-title text-sky-500">Subscription Terms</h1>
          <p className="text-sm text-muted-foreground">
            Manage pricing and discounts for each package duration
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
            <Button className="bg-sky-500 text-white rounded-sm cursor-pointer">
              <Plus className="mr-2 size-4" />
              Add Term
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sky-500">
                Add subscription term
              </DialogTitle>
              <DialogDescription>
                Create a new billing term under a category, plan, and package.
              </DialogDescription>
            </DialogHeader>
            {termFormFields("add")}
            <DialogFooter>
              <Button
                className="h-9 bg-red-500 text-white rounded-sm  hover:bg-red-600 hover:text-white cursor-pointer"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="h-9 bg-sky-500 text-white rounded-sm hover:bg-sky-600 hover:text-white cursor-pointer"
                onClick={handleAdd}
                disabled={!isFormValid}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search terms..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="size-4" />
              Filter
              {durationFilter !== "__all" && (
                <span className="text-muted-foreground">
                  {durationOptions.find(
                    (option) =>
                      `${option.value}:${option.unit}` === durationFilter,
                  )?.label ?? "Selected"}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={durationFilter}
              onValueChange={(value) => {
                setDurationFilter(value);
                setCurrentPage(1);
              }}
            >
              <DropdownMenuRadioItem value="__all">
                All terms ({allTerms.length})
              </DropdownMenuRadioItem>
              {durationOptions.map((option) => (
                <DropdownMenuRadioItem
                  key={`${option.value}:${option.unit}`}
                  value={`${option.value}:${option.unit}`}
                >
                  {`${option.label} (${allTerms.filter((term) => term.subscriptiontermdurationvalue === option.value && term.subscriptiontermdurationunit === option.unit).length})`}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">ID</TableHead>
              <TableHead className="text-center">Term</TableHead>
              <TableHead className="text-center">Price</TableHead>
              <TableHead className="text-center">Discount</TableHead>
              <TableHead className="text-center">Final price</TableHead>
              <TableHead className="text-center">Category</TableHead>
              <TableHead className="text-center">Plan</TableHead>
              <TableHead className="text-center">Package</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTerms.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="text-center py-10 text-muted-foreground"
                >
                  No subscription terms found
                </TableCell>
              </TableRow>
            ) : (
              paginatedTerms.map((term) => (
                <TableRow
                  key={`${term.subscriptionCateId}-${term.subscriptionPlanId}-${term.SubscriptionPackageId}-${term.SubscriptionTermId}`}
                >
                  <TableCell className="text-center">
                    {term.SubscriptionTermId}
                  </TableCell>
                  <TableCell className="text-center">
                    {getDurationBadge(
                      term.subscriptiontermdurationvalue,
                      term.subscriptiontermdurationunit,
                    )}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {formatPrice(term.subscriptiontermprice)}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {formatDiscountDisplay(
                      term.subscriptiontermdiscount,
                      normalizeDiscountType(term.subscriptiontermdiscounttype),
                    )}
                  </TableCell>
                  <TableCell className="text-center font-medium text-emerald-700">
                    {formatPrice(
                      calcFinalPrice(
                        term.subscriptiontermprice,
                        term.subscriptiontermdiscount,
                        normalizeDiscountType(
                          term.subscriptiontermdiscounttype,
                        ),
                      ),
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {term.categoryName}
                  </TableCell>
                  <TableCell className="text-center">{term.planName}</TableCell>
                  <TableCell className="text-center">
                    {getPackageBadge(term.packageName)}
                  </TableCell>
                  <TableCell>{formatDate(term.createdAt)}</TableCell>
                  <TableCell>{formatDate(term.updatedAt)}</TableCell>
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
                          className="text-yellow-500 cursor-pointer"
                          onClick={() => openEditDialog(term)}
                        >
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive cursor-pointer"
                          onClick={() => openDeleteDialog(term)}
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
            setSelectedTerm(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sky-500">
              Edit subscription term
            </DialogTitle>
            <DialogDescription>
              Update term pricing or move it to another package.
            </DialogDescription>
          </DialogHeader>
          {termFormFields("edit")}
          <DialogFooter>
            <Button
              className="h-9 bg-red-500 text-white rounded-sm hover:bg-red-600 hover:text-white cursor-pointer"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-9 bg-sky-500 text-white rounded-sm hover:bg-sky-600 hover:text-white cursor-pointer"
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
            <DialogTitle>Delete subscription term</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;
              <span className="font-semibold text-red-500">
                {selectedTerm?.subscriptiontermname}
              </span>
              &quot; (
              {selectedTerm &&
                formatPrice(
                  calcFinalPrice(
                    selectedTerm.subscriptiontermprice,
                    selectedTerm.subscriptiontermdiscount,
                    normalizeDiscountType(
                      selectedTerm.subscriptiontermdiscounttype,
                    ),
                  ),
                )}
              ) from{" "}
              <span className="font-semibold text-red-500">
                {selectedTerm?.categoryName}
              </span>{" "}
              /{" "}
              <span className="font-semibold text-red-500">
                {selectedTerm?.planName}
              </span>{" "}
              /{" "}
              <span className="font-semibold text-red-500">
                {selectedTerm?.packageName}
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
              className="h-9 bg-sky-500 text-white rounded-sm hover:bg-sky-600 hover:text-white cursor-pointer"
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
