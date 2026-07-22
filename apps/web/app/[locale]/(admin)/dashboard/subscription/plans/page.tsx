'use client'

import { useMemo, useState } from "react"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { SubscriptionCategory, SubscriptionPlan } from "@/types/subscription"
import { subscriptioncategories as initialSubscriptionCategories } from "@/lib/Subscriptions"


type PlanRow = SubscriptionPlan & {
    subscriptionCateId: string
    categoryName: string
}

function formatDate(date: Date) {
    return new Date(date).toLocaleDateString()
}

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
}

function flattenPlans(categories: SubscriptionCategory[]): PlanRow[] {
    return categories.flatMap((category) =>
        category.subscriptionplans.map((plan) => ({
            ...plan,
            subscriptionCateId: category.subscriptionCateId,
            categoryName: category.subscriptioncatename,
        }))
    )
}

const emptyForm = {
    categoryId: "",
    name: "",
    slug: "",
    desc: "",
}

export default function SubscriptionPlanPage() {
    const [subscriptionCategories, setSubscriptionCategories] =
        useState<SubscriptionCategory[]>(initialSubscriptionCategories)
    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const [searchQuery, setSearchQuery] = useState("")
    const [tab, setTab] = useState("all")
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [selectedPlan, setSelectedPlan] = useState<PlanRow | null>(null)
    const [formData, setFormData] = useState(emptyForm)

    const allPlans = useMemo(
        () => flattenPlans(subscriptionCategories),
        [subscriptionCategories]
    )

    const filteredPlans = allPlans.filter((plan) => {
        const q = searchQuery.toLowerCase()

        const matchesSearch =
            plan.subscriptionPlanId.toLowerCase().includes(q) ||
            plan.subscriptionplanname.toLowerCase().includes(q) ||
            plan.subscriptionplanslug.toLowerCase().includes(q) ||
            plan.subscriptionplandesc.toLowerCase().includes(q) ||
            plan.categoryName.toLowerCase().includes(q) ||
            plan.subscriptionCateId.toLowerCase().includes(q) ||
            formatDate(plan.createdAt).toLowerCase().includes(q) ||
            formatDate(plan.updatedAt).toLowerCase().includes(q)

            const matchesTab =
            tab === "all"
                ? true
                : tab === "bronze"
                    ? plan.subscriptionplanname === "Bronze"
                    : tab === "siliver"
                        ? plan.subscriptionplanname === "Siliver"
                        : tab === "gold"
                            ? plan.subscriptionplanname === "Gold"
                                : true

        return matchesSearch && matchesTab    
        
    })

    const totalPages = Math.max(1, Math.ceil(filteredPlans.length / rowsPerPage))
    const startIndex = (currentPage - 1) * rowsPerPage
    const paginatedPlans = filteredPlans.slice(startIndex, startIndex + rowsPerPage)

    const resetForm = () => setFormData(emptyForm)

    const handleAdd = () => {
        const categoryId = formData.categoryId
        if (!categoryId) return

        const now = new Date()
        const nextId = String(
            Math.max(
                0,
                ...allPlans.map((p) => Number(p.subscriptionPlanId) || 0)
            ) + 1
        )
        const slug = formData.slug.trim() || slugify(formData.name)

        const newPlan: SubscriptionPlan = {
            subscriptionPlanId: nextId,
            subscriptionplanname: formData.name.trim(),
            subscriptionplanslug: slug,
            subscriptionplandesc: formData.desc.trim(),
            subscriptionpackage: [],
            createdAt: now,
            updatedAt: now,
        }

        setSubscriptionCategories((prev) =>
            prev.map((category) =>
                category.subscriptionCateId === categoryId
                    ? {
                          ...category,
                          subscriptionplans: [...category.subscriptionplans, newPlan],
                          updatedAt: now,
                      }
                    : category
            )
        )
        resetForm()
        setIsAddDialogOpen(false)
    }

    const handleUpdate = () => {
        if (!selectedPlan || !formData.categoryId) return

        const now = new Date()
        const slug = formData.slug.trim() || slugify(formData.name)
        const targetCategoryId = formData.categoryId

        setSubscriptionCategories((prev) => {
            const sourceCategory = prev.find(
                (c) => c.subscriptionCateId === selectedPlan.subscriptionCateId
            )
            const existingPlan = sourceCategory?.subscriptionplans.find(
                (p) => p.subscriptionPlanId === selectedPlan.subscriptionPlanId
            )
            if (!existingPlan) return prev

            const updatedPlan: SubscriptionPlan = {
                ...existingPlan,
                subscriptionplanname: formData.name.trim(),
                subscriptionplanslug: slug,
                subscriptionplandesc: formData.desc.trim(),
                updatedAt: now,
            }

            return prev.map((category) => {
                if (category.subscriptionCateId === selectedPlan.subscriptionCateId) {
                    const without = category.subscriptionplans.filter(
                        (p) => p.subscriptionPlanId !== selectedPlan.subscriptionPlanId
                    )
                    if (targetCategoryId === selectedPlan.subscriptionCateId) {
                        return {
                            ...category,
                            subscriptionplans: [...without, updatedPlan],
                            updatedAt: now,
                        }
                    }
                    return { ...category, subscriptionplans: without, updatedAt: now }
                }
                if (category.subscriptionCateId === targetCategoryId) {
                    return {
                        ...category,
                        subscriptionplans: [...category.subscriptionplans, updatedPlan],
                        updatedAt: now,
                    }
                }
                return category
            })
        })

        resetForm()
        setSelectedPlan(null)
        setIsEditDialogOpen(false)
    }

    const openEditDialog = (plan: PlanRow) => {
        setSelectedPlan(plan)
        setFormData({
            categoryId: plan.subscriptionCateId,
            name: plan.subscriptionplanname,
            slug: plan.subscriptionplanslug,
            desc: plan.subscriptionplandesc,
        })
        setIsEditDialogOpen(true)
    }

    const openDeleteDialog = (plan: PlanRow) => {
        setSelectedPlan(plan)
        setIsDeleteDialogOpen(true)
    }

    const handleDelete = () => {
        if (!selectedPlan) return

        const now = new Date()
        setSubscriptionCategories((prev) =>
            prev.map((category) =>
                category.subscriptionCateId === selectedPlan.subscriptionCateId
                    ? {
                          ...category,
                          subscriptionplans: category.subscriptionplans.filter(
                              (p) => p.subscriptionPlanId !== selectedPlan.subscriptionPlanId
                          ),
                          updatedAt: now,
                      }
                    : category
            )
        )
        setIsDeleteDialogOpen(false)
        setSelectedPlan(null)
    }

    const planFormFields = (idPrefix: string, includeCategory: boolean) => (
        <div className="grid gap-4 py-4">
            {includeCategory && (
                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-category`}>Category</Label>
                    <Select
                        value={formData.categoryId}
                        onValueChange={(value) =>
                            setFormData({ ...formData, categoryId: value })
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
            )}
            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-name`}>Plan name</Label>
                <Input
                    id={`${idPrefix}-name`}
                    placeholder="e.g. Bronze"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
            </div>
            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-slug`}>Slug</Label>
                <Input
                    id={`${idPrefix}-slug`}
                    placeholder="e.g. bronze"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                />
            </div>
            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-desc`}>Description</Label>
                <Textarea
                    id={`${idPrefix}-desc`}
                    placeholder="Plan description..."
                    value={formData.desc}
                    onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                    rows={4}
                />
            </div>
        </div>
    )
    const getPlanBadge = (type: PlanRow["subscriptionplanname"]) => {
        const colors: Record<PlanRow["subscriptionplanname"], string> = {
          Bronze: "text-foreground border-amber-950/30 bg-amber-950/10",
          Siliver: "text-slate-500 border-slate-500/30 bg-slate-500/10",
          Gold:"text-amber-500 border-amber-500/30 bg-amber-500/10",
        }
        return (
          <Badge variant="outline" className={colors[type]}>
            {type}
          </Badge>
        )
      }

    const isFormValid =
        formData.name.trim().length > 0 && formData.categoryId.length > 0

    return (
        <main className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl text-sky-500 font-semibold">Subscription Plans</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage subscription plans across categories
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
                        <Button className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer">
                            <Plus className="mr-2 size-4" />
                            Add Subscription Plan
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add subscription plan</DialogTitle>
                            <DialogDescription>
                                Create a new plan under a subscription category.
                            </DialogDescription>
                        </DialogHeader>
                        {planFormFields("add", true)}
                        <DialogFooter>
                            <Button className="h-9 bg-red-500 rounded-sm text-white hover:bg-red-600 hover:text-white cursor-pointer" onClick={() => setIsAddDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button className="h-9 bg-sky-500 rounded-sm text-white hover:bg-sky-600 hover:text-white cursor-pointer" onClick={handleAdd} disabled={!isFormValid}>
                                Save
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="relative w-95">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                    placeholder="Search plans..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setCurrentPage(1)
                    }}
                    className="pl-9"
                />
            </div>
            <div className="mt-6">
                        <Tabs
                            value={tab}
                            onValueChange={(value) => {
                                setTab(value)
                                setCurrentPage(1)
                            }}
                        >
                            <TabsList className="gap-1">
                                <TabsTrigger value="all" className="cursor-pointer">All Subscription</TabsTrigger>
                                <TabsTrigger value="bronze" className="cursor-pointer">
                                    Bronze
                                    <Badge className="ml-1.5 px-1.5 py-0.5 text-xs text-foreground border-amber-950/30 bg-amber-950/10">
                                        {allPlans.filter((plan) => plan.subscriptionplanname === "Bronze").length}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="siliver" className="cursor-pointer">
                                    Siliver
                                    <Badge className="ml-1.5 px-1.5 py-0.5 text-xs text-foreground border-slate-500/30 bg-slate-500/10">
                                        {allPlans.filter((plan) => plan.subscriptionplanname === "Siliver").length}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="gold" className="cursor-pointer">
                                    Gold
                                    <Badge className="ml-1.5 px-1.5 py-0.5 text-xs text-foreground border-amber-500/30 bg-amber-500/10">
                                        {allPlans.filter((plan) => plan.subscriptionplanname === "Gold").length}
                                    </Badge>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-center">ID</TableHead>
                            <TableHead className="text-center">Plan Name</TableHead>
                            <TableHead className="text-center">Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-center">Packages</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Updated</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedPlans.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={8}
                                    className="text-center py-10 text-muted-foreground"
                                >
                                    No subscription plans found
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedPlans.map((plan) => (
                                <TableRow
                                    key={`${plan.subscriptionCateId}-${plan.subscriptionPlanId}`}
                                >
                                    <TableCell className="text-center">
                                        {plan.subscriptionPlanId}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {getPlanBadge(plan.subscriptionplanname)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {plan.categoryName}
                                    </TableCell>
                                    <TableCell className="max-w-sm truncate">
                                        {plan.subscriptionplandesc}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {plan.subscriptionpackage.length}
                                    </TableCell>
                                    <TableCell>{formatDate(plan.createdAt)}</TableCell>
                                    <TableCell>{formatDate(plan.updatedAt)}</TableCell>
                                    <TableCell className="flex justify-center">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button size="icon" variant="outline" className="rounded-full cursor-pointer">
                                                    <MoreVertical className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="center">
                                                <DropdownMenuItem
                                                className="text-yellow-500 cursor-pointer"
                                                    onClick={() => openEditDialog(plan)}
                                                >
                                                    <Pencil className="mr-2 size-4" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-destructive cursor-pointer"
                                                    onClick={() => openDeleteDialog(plan)}
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
                        setSelectedPlan(null)
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit subscription plan</DialogTitle>
                        <DialogDescription>
                            Update plan details or move it to another category.
                        </DialogDescription>
                    </DialogHeader>
                    {planFormFields("edit", true)}
                    <DialogFooter>
                        <Button className="h-9 bg-red-500 text-white rounded-sm hover:bg-red-600 hover:text-white  cursor-pointer" onClick={() => setIsEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button className="h-9  rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer" onClick={handleUpdate} disabled={!isFormValid}>
                            Save changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete subscription plan</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete
                            <span className="font-semibold text-rose-500"> 
                                &quot;{selectedPlan?.subscriptionplanname}&quot;
                            </span> This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button className="h-9 bg-red-500 text-white rounded-sm hover:bg-red-600 hover:text-white  cursor-pointer" onClick={() => setIsDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button className="h-9  rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer" onClick={handleDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    )
}
