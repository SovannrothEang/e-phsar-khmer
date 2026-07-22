'use client'

import { useMemo, useState } from "react"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoreVertical, Search, Trash2, Plus, Pencil } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from "lucide-react"
import {
    SubscriptionCategory,
    SubscriptionPackageOption,
    SubscriptionTermDiscountType,
    SubscriptionTermDurationUnit,
    SubscriptionTermOption,
} from "@/types/subscription"
import { subscriptioncategories as initialSubscriptionCategories } from "@/lib/Subscriptions"

type PackageTier = "Bronze" | "Siliver" | "Gold"

type TermRow = SubscriptionTermOption & {
    subscriptionCateId: string
    categoryName: string
    subscriptionPlanId: string
    planName: string
    SubscriptionPackageId: string
    packageName: string
}

function formatDate(date: Date) {
    return new Date(date).toLocaleDateString()
}

function formatPrice(amount: number) {
    return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function calcFinalPrice(
    price: number,
    discount: number,
    type: SubscriptionTermDiscountType
): number {
    if (discount <= 0 || price <= 0) return price
    if (type === "percent") {
        const pct = Math.min(100, Math.max(0, discount))
        return Math.max(0, price * (1 - pct / 100))
    }
    return Math.max(0, price - discount)
}

function formatDiscountDisplay(
    discount: number,
    type: SubscriptionTermDiscountType
): string {
    if (discount <= 0) return "—"
    return type === "percent" ? `${discount}%` : formatPrice(discount)
}

function normalizeDiscountType(
    type: SubscriptionTermDiscountType | undefined
): SubscriptionTermDiscountType {
    return type === "percent" ? "percent" : "amount"
}

function formatDuration(value: number, unit: SubscriptionTermDurationUnit) {
    const unitLabel =
        unit === "day" ? "Day" : unit === "month" ? "Month" : "Year"
    const plural = value === 1 ? "" : "s"
    return `${value} ${unitLabel}${plural}`
}

type DurationPresetKey =
    | "1-day"
    | "1-month"
    | "2-month"
    | "3-month"
    | "4-month"
    | "5-month"
    | "6-month"
    | "1-year"
    | "2-year"

const DURATION_PRESETS: Array<{
    key: DurationPresetKey
    value: number
    unit: SubscriptionTermDurationUnit
    label: string
}> = [
        { key: "1-day", value: 1, unit: "day", label: "1 Day" },
        { key: "1-month", value: 1, unit: "month", label: "1 Month" },
        { key: "2-month", value: 2, unit: "month", label: "2 Months" },
        { key: "3-month", value: 3, unit: "month", label: "3 Months" },
        { key: "4-month", value: 4, unit: "month", label: "4 Months" },
        { key: "5-month", value: 5, unit: "month", label: "5 Months" },
        { key: "6-month", value: 6, unit: "month", label: "6 Months" },
        { key: "1-year", value: 1, unit: "year", label: "1 Year" },
        { key: "2-year", value: 2, unit: "year", label: "2 Years" },
    ]

function flattenTerms(categories: SubscriptionCategory[]): TermRow[] {
    return categories.flatMap((category) =>
        category.subscriptionplans.flatMap((plan) =>
            plan.subscriptionpackage.flatMap((pkg) =>
                pkg.subscriptionterm.map((term) => ({
                    ...term,
                    subscriptionCateId: category.subscriptionCateId,
                    categoryName: category.subscriptioncatename,
                    subscriptionPlanId: plan.subscriptionPlanId,
                    planName: plan.subscriptionplanname,
                    SubscriptionPackageId: pkg.SubscriptionPackageId,
                    packageName: pkg.subscriptionPackagename,
                }))
            )
        )
    )
}

const emptyForm = {
    categoryId: "",
    planId: "",
    packageId: "",
    durationPreset: "" as "" | DurationPresetKey,
    durationValue: "",
    durationUnit: "month" as SubscriptionTermDurationUnit,
    name: "",
    price: "",
    discount: "",
    discountType: "amount" as SubscriptionTermDiscountType,
}

export default function SubscriptionTermPage() {
    const [subscriptionCategories, setSubscriptionCategories] =
        useState<SubscriptionCategory[]>(initialSubscriptionCategories)
    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const [searchQuery, setSearchQuery] = useState("")
    const [tab, setTab] = useState("all")
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [selectedTerm, setSelectedTerm] = useState<TermRow | null>(null)
    const [formData, setFormData] = useState(emptyForm)

    const allTerms = useMemo(
        () => flattenTerms(subscriptionCategories),
        [subscriptionCategories]
    )

    const plansForCategory = useMemo(() => {
        const category = subscriptionCategories.find(
            (c) => c.subscriptionCateId === formData.categoryId
        )
        return category?.subscriptionplans ?? []
    }, [subscriptionCategories, formData.categoryId])

    const packagesForPlan = useMemo(() => {
        const category = subscriptionCategories.find(
            (c) => c.subscriptionCateId === formData.categoryId
        )
        const plan = category?.subscriptionplans.find(
            (p) => p.subscriptionPlanId === formData.planId
        )
        return plan?.subscriptionpackage ?? []
    }, [subscriptionCategories, formData.categoryId, formData.planId])

    const filteredTerms = allTerms.filter((term) => {
        const q = searchQuery.toLowerCase()

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
            formatDate(term.updatedAt).toLowerCase().includes(q)

        const matchesTab =
            tab === "all"
                ? true
                : tab === "3months"
                    ? term.subscriptiontermname === "3 Months"
                    : tab === "6months"
                        ? term.subscriptiontermname === "6 Months"
                        : tab === "1year"
                            ? term.subscriptiontermname === "1 Year"
                            : true

        return matchesSearch && matchesTab
    })

    const totalPages = Math.max(1, Math.ceil(filteredTerms.length / rowsPerPage))
    const startIndex = (currentPage - 1) * rowsPerPage
    const paginatedTerms = filteredTerms.slice(
        startIndex,
        startIndex + rowsPerPage
    )

    const resetForm = () => setFormData(emptyForm)

    const updateTermInCategories = (

        updater: (terms: SubscriptionTermOption[]) => SubscriptionTermOption[]
    ) => {
        const { categoryId, planId, packageId } = formData
        if (!categoryId || !planId || !packageId) return

        const now = new Date()
        setSubscriptionCategories((prev) =>
            prev.map((category) =>
                category.subscriptionCateId === categoryId
                    ? {
                        ...category,
                        subscriptionplans: category.subscriptionplans.map((plan) =>
                            plan.subscriptionPlanId === planId
                                ? {
                                    ...plan,
                                    subscriptionpackage: plan.subscriptionpackage.map(
                                        (pkg) =>
                                            pkg.SubscriptionPackageId === packageId
                                                ? {
                                                    ...pkg,
                                                    subscriptionterm: updater(
                                                        pkg.subscriptionterm
                                                    ),
                                                    updatedAt: now,
                                                }
                                                : pkg
                                    ),
                                    updatedAt: now,
                                }
                                : plan
                        ),
                        updatedAt: now,
                    }
                    : category
            )
        )
    }

    const handleAdd = () => {
        const { categoryId, planId, packageId } = formData
        if (!categoryId || !planId || !packageId) return

        const now = new Date()
        const nextId = String(
            Math.max(
                0,
                ...allTerms.map((t) => Number(t.SubscriptionTermId) || 0)
            ) + 1
        )

        const durationValue =
            Number(formData.durationValue) || 1

        const durationUnit =
            formData.durationUnit || "month"

        const newTerm: SubscriptionTermOption = {
            SubscriptionTermId: nextId,

            subscriptiontermname: formatDuration(
                durationValue,
                durationUnit
            ),

            subscriptiontermdurationvalue: durationValue,

            subscriptiontermdurationunit: durationUnit,

            subscriptiontermprice: Number(formData.price) || 0,

            subscriptiontermdiscount:
                Number(formData.discount) || 0,

            subscriptiontermdiscounttype:
                formData.discountType,

            createdAt: now,
            updatedAt: now,
        }

        updateTermInCategories((terms) => [...terms, newTerm])
        resetForm()
        setIsAddDialogOpen(false)
    }

    const handleUpdate = () => {

        if (!selectedTerm || !formData.categoryId || !formData.planId || !formData.packageId)
            return

        const now = new Date()
        const targetCategoryId = formData.categoryId
        const targetPlanId = formData.planId
        const targetPackageId = formData.packageId
        const sameLocation =
            targetCategoryId === selectedTerm.subscriptionCateId &&
            targetPlanId === selectedTerm.subscriptionPlanId &&
            targetPackageId === selectedTerm.SubscriptionPackageId

        setSubscriptionCategories((prev) => {
            const sourceCategory = prev.find(
                (c) => c.subscriptionCateId === selectedTerm.subscriptionCateId
            )
            const sourcePlan = sourceCategory?.subscriptionplans.find(
                (p) => p.subscriptionPlanId === selectedTerm.subscriptionPlanId
            )
            const sourcePackage = sourcePlan?.subscriptionpackage.find(
                (p) => p.SubscriptionPackageId === selectedTerm.SubscriptionPackageId
            )
            const existing = sourcePackage?.subscriptionterm.find(
                (t) => t.SubscriptionTermId === selectedTerm.SubscriptionTermId
            )
            if (!existing) return prev

            const updatedTerm: SubscriptionTermOption = {
                ...existing,
                subscriptiontermname: formData.name.trim(),
                subscriptiontermprice: Number(formData.price) || 0,
                subscriptiontermdiscount: Number(formData.discount) || 0,
                subscriptiontermdiscounttype: formData.discountType,
                subscriptiontermdurationvalue:
                    Number(formData.durationValue) || 1,
                subscriptiontermdurationunit:
                    formData.durationUnit,
                // subscriptiontermname: formatDuration(
                //     Number(formData.durationValue) || 1,
                //     formData.durationUnit
                // ),
                updatedAt: now,
            }

            const mapPackageTerms = (
                pkg: SubscriptionPackageOption,
                terms: SubscriptionTermOption[]
            ): SubscriptionPackageOption => ({ ...pkg, subscriptionterm: terms, updatedAt: now })

            return prev.map((category) => {
                const isSource =
                    category.subscriptionCateId === selectedTerm.subscriptionCateId
                const isTarget = category.subscriptionCateId === targetCategoryId

                if (isSource && isTarget && sameLocation) {
                    return {
                        ...category,
                        subscriptionplans: category.subscriptionplans.map((plan) =>
                            plan.subscriptionPlanId === targetPlanId
                                ? {
                                    ...plan,
                                    subscriptionpackage: plan.subscriptionpackage.map(
                                        (pkg) =>
                                            pkg.SubscriptionPackageId === targetPackageId
                                                ? mapPackageTerms(
                                                    pkg,
                                                    pkg.subscriptionterm.map((t) =>
                                                        t.SubscriptionTermId ===
                                                            selectedTerm.SubscriptionTermId
                                                            ? updatedTerm
                                                            : t
                                                    )
                                                )
                                                : pkg
                                    ),
                                    updatedAt: now,
                                }
                                : plan
                        ),
                        updatedAt: now,
                    }
                }

                if (isSource) {
                    return {
                        ...category,
                        subscriptionplans: category.subscriptionplans.map((plan) =>
                            plan.subscriptionPlanId === selectedTerm.subscriptionPlanId
                                ? {
                                    ...plan,
                                    subscriptionpackage: plan.subscriptionpackage.map(
                                        (pkg) =>
                                            pkg.SubscriptionPackageId ===
                                                selectedTerm.SubscriptionPackageId
                                                ? mapPackageTerms(
                                                    pkg,
                                                    pkg.subscriptionterm.filter(
                                                        (t) =>
                                                            t.SubscriptionTermId !==
                                                            selectedTerm.SubscriptionTermId
                                                    )
                                                )
                                                : pkg
                                    ),
                                    updatedAt: now,
                                }
                                : plan
                        ),
                        updatedAt: now,
                    }
                }

                if (isTarget) {
                    return {
                        ...category,
                        subscriptionplans: category.subscriptionplans.map((plan) =>
                            plan.subscriptionPlanId === targetPlanId
                                ? {
                                    ...plan,
                                    subscriptionpackage: plan.subscriptionpackage.map(
                                        (pkg) =>
                                            pkg.SubscriptionPackageId === targetPackageId
                                                ? mapPackageTerms(pkg, [
                                                    ...pkg.subscriptionterm,
                                                    updatedTerm,
                                                ])
                                                : pkg
                                    ),
                                    updatedAt: now,
                                }
                                : plan
                        ),
                        updatedAt: now,
                    }
                }

                return category
            })
        })

        resetForm()
        setSelectedTerm(null)
        setIsEditDialogOpen(false)
    }

    const openEditDialog = (term: TermRow) => {
        setSelectedTerm(term)

        setFormData({
            categoryId: term.subscriptionCateId,
            planId: term.subscriptionPlanId,
            packageId: term.SubscriptionPackageId,

            durationPreset: "",
            durationValue: "",
            durationUnit: "month",

            name: term.subscriptiontermname,
            price: String(term.subscriptiontermprice),
            discount: String(term.subscriptiontermdiscount),
            discountType: normalizeDiscountType(
                term.subscriptiontermdiscounttype
            ),
        })

        setIsEditDialogOpen(true)
    }

    const openDeleteDialog = (term: TermRow) => {
        setSelectedTerm(term)
        setIsDeleteDialogOpen(true)
    }

    const handleDelete = () => {
        if (!selectedTerm) return

        const now = new Date()
        setSubscriptionCategories((prev) =>
            prev.map((category) =>
                category.subscriptionCateId === selectedTerm.subscriptionCateId
                    ? {
                        ...category,
                        subscriptionplans: category.subscriptionplans.map((plan) =>
                            plan.subscriptionPlanId === selectedTerm.subscriptionPlanId
                                ? {
                                    ...plan,
                                    subscriptionpackage: plan.subscriptionpackage.map(
                                        (pkg) =>
                                            pkg.SubscriptionPackageId ===
                                                selectedTerm.SubscriptionPackageId
                                                ? {
                                                    ...pkg,
                                                    subscriptionterm:
                                                        pkg.subscriptionterm.filter(
                                                            (t) =>
                                                                t.SubscriptionTermId !==
                                                                selectedTerm.SubscriptionTermId
                                                        ),
                                                    updatedAt: now,
                                                }
                                                : pkg
                                    ),
                                    updatedAt: now,
                                }
                                : plan
                        ),
                        updatedAt: now,
                    }
                    : category
            )
        )
        setIsDeleteDialogOpen(false)
        setSelectedTerm(null)
    }

    const formPrice = Number(formData.price) || 0
    const formDiscount = Number(formData.discount) || 0
    const formFinalPrice = calcFinalPrice(
        formPrice,
        formDiscount,
        formData.discountType
    )

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
            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-name`}>Term name</Label>
                <Input
                    id={`${idPrefix}-name`}
                    placeholder="e.g. 6 Months"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
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
                    onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                    }
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
                        Discount{" "}
                        {formData.discountType === "percent" ? "(%)" : "($)"}
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
                            {formatDiscountDisplay(
                                formDiscount,
                                formData.discountType
                            )}
                            )
                        </span>
                    )}
                </div>
            )}
        </div>
    )

    const getDurationBadge = (
        value: number,
        unit: SubscriptionTermDurationUnit
    ) => {
        const label = formatDuration(value, unit)

        let className =
            "text-muted-foreground border-muted bg-muted/30"

        if (value === 3 && unit === "month") {
            className =
                "text-sky-700 border-sky-700/30 bg-sky-700/10"
        }

        if (value === 6 && unit === "month") {
            className =
                "text-emerald-700 border-emerald-700/30 bg-emerald-700/10"
        }

        if (value === 1 && unit === "year") {
            className =
                "text-violet-700 border-violet-700/30 bg-violet-700/10"
        }

        return (
            <Badge variant="outline" className={className}>
                {label}
            </Badge>
        )
    }

    const getPackageBadge = (name: string) => {
        const tier = name as PackageTier
        const colors: Record<PackageTier, string> = {
            Bronze: "text-foreground border-amber-950/30 bg-amber-950/10",
            Siliver: "text-slate-500 border-slate-500/30 bg-slate-500/10",
            Gold: "text-amber-500 border-amber-500/30 bg-amber-500/10",
        }
        const className = colors[tier] ?? "text-muted-foreground"
        return (
            <Badge variant="outline" className={className}>
                {name}
            </Badge>
        )
    }

    const countByDuration = (
        value: number,
        unit: SubscriptionTermDurationUnit
    ) =>
        allTerms.filter(
            (t) =>
                t.subscriptiontermdurationvalue === value &&
                t.subscriptiontermdurationunit === unit
        ).length

    const isFormValid =
        formData.name.trim().length > 0 &&
        formData.categoryId.length > 0 &&
        formData.planId.length > 0 &&
        formData.packageId.length > 0 &&
        formData.price.trim().length > 0

    return (
        <main className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl text-sky-500 font-semibold">Subscription Terms</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage pricing and discounts for each package duration
                    </p>
                </div>

                <Dialog
                    open={isAddDialogOpen}
                    onOpenChange={(open) => {
                        setIsAddDialogOpen(open)
                        if (!open) resetForm()
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
                            <DialogTitle className="text-sky-500">Add subscription term</DialogTitle>
                            <DialogDescription>
                                Create a new billing term under a category, plan, and package.
                            </DialogDescription>
                        </DialogHeader>
                        {termFormFields("add")}
                        <DialogFooter>
                            <Button className="h-9 bg-red-500 text-white rounded-sm  hover:bg-red-600 hover:text-white cursor-pointer" onClick={() => setIsAddDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button className="h-9 bg-sky-500 text-white rounded-sm hover:bg-sky-600 hover:text-white cursor-pointer" onClick={handleAdd} disabled={!isFormValid}>
                                Save
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                    placeholder="Search terms..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setCurrentPage(1)
                    }}
                    className="pl-9"
                />
            </div>

            <Tabs
                value={tab}
                onValueChange={(value) => {
                    setTab(value)
                    setCurrentPage(1)
                }}
            >
                <TabsList className="gap-1">
                    <TabsTrigger value="all" className="cursor-pointer">
                        All Terms
                    </TabsTrigger>
                    <TabsTrigger value="3months" className="cursor-pointer">
                        3 Months
                        <Badge className="ml-1.5 px-1.5 py-0.5 text-xs">
                            {countByDuration(3, "month")}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="6months" className="cursor-pointer">
                        6 Months
                        <Badge className="ml-1.5 px-1.5 py-0.5 text-xs">
                            {countByDuration(6, "month")}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="1year" className="cursor-pointer">
                        1 Year
                        <Badge className="ml-1.5 px-1.5 py-0.5 text-xs">
                            {countByDuration(1, "year")}
                        </Badge>
                    </TabsTrigger>
                </TabsList>
            </Tabs>

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
                                            term.subscriptiontermdurationunit
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center font-medium">
                                        {formatPrice(term.subscriptiontermprice)}
                                    </TableCell>
                                    <TableCell className="text-center text-muted-foreground">
                                        {formatDiscountDisplay(
                                            term.subscriptiontermdiscount,
                                            normalizeDiscountType(
                                                term.subscriptiontermdiscounttype
                                            )
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center font-medium text-emerald-700">
                                        {formatPrice(
                                            calcFinalPrice(
                                                term.subscriptiontermprice,
                                                term.subscriptiontermdiscount,
                                                normalizeDiscountType(
                                                    term.subscriptiontermdiscounttype
                                                )
                                            )
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {term.categoryName}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {term.planName}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {getPackageBadge(term.packageName)}
                                    </TableCell>
                                    <TableCell>{formatDate(term.createdAt)}</TableCell>
                                    <TableCell>{formatDate(term.updatedAt)}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button size="icon" variant="outline" className="rounded-full cursor-pointer" >
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
                                setRowsPerPage(Number(value))
                                setCurrentPage(1)
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
                    setIsEditDialogOpen(open)
                    if (!open) {
                        resetForm()
                        setSelectedTerm(null)
                    }
                }}
            >
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-sky-500">Edit subscription term</DialogTitle>
                        <DialogDescription>
                            Update term pricing or move it to another package.
                        </DialogDescription>
                    </DialogHeader>
                    {termFormFields("edit")}
                    <DialogFooter>
                        <Button className="h-9 bg-red-500 text-white rounded-sm hover:bg-red-600 hover:text-white cursor-pointer" onClick={() => setIsEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button className="h-9 bg-sky-500 text-white rounded-sm hover:bg-sky-600 hover:text-white cursor-pointer" onClick={handleUpdate} disabled={!isFormValid}>
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
                            <span className="font-semibold text-red-500">{selectedTerm?.subscriptiontermname}</span>&quot; (
                            {selectedTerm &&
                                formatPrice(
                                    calcFinalPrice(
                                        selectedTerm.subscriptiontermprice,
                                        selectedTerm.subscriptiontermdiscount,
                                        normalizeDiscountType(
                                            selectedTerm.subscriptiontermdiscounttype
                                        )
                                    )
                                )}
                            ) from{" "}
                            <span className="font-semibold text-red-500">{selectedTerm?.categoryName}</span> / <span className="font-semibold text-red-500">{selectedTerm?.planName}</span> /{" "}
                            <span className="font-semibold text-red-500">{selectedTerm?.packageName}</span>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button className="h-9 bg-red-500 text-white rounded-sm hover:bg-red-600 hover:text-white cursor-pointer" onClick={() => setIsDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button className="h-9 bg-sky-500 text-white rounded-sm hover:bg-sky-600 hover:text-white cursor-pointer" onClick={handleDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    )
}
