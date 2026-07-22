'use client'

import { useState } from "react"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoreVertical, Search } from "lucide-react"
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
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from "lucide-react"

type Subscription = {
    id: string
    accountId: string
    name: string
    email: string
    phone: string
    category: "Auto" | "Food" | "General" | "Property" | "Services"
    totalAds: number
    totalRenew: number
    autoRenew: number
    plan: "6 Months" | "1 Year"
    price: number
    paymentMethod: "Bank" | "Credit Card" | "Debit Card"
    subscribedAt: string
    expiredAt: string
}

const initialSubscription: Subscription[] = [
    {
        id: "1",
        accountId: "1",
        name: "Eddie Lake",
        email: "eddie@example.com",
        phone: "012345678",
        category: "Auto",
        totalAds: 25,
        totalRenew: 3,
        autoRenew: 12,
        plan: "1 Year",
        price: 120,
        paymentMethod: "Credit Card",
        subscribedAt: "2024-01-01",
        expiredAt: "2025-01-01",
    },
    {
        id: "2",
        accountId: "7",
        name: "Sarah Chen",
        email: "sarah@example.com",
        phone: "098765432",
        category: "Property",
        totalAds: 10,
        totalRenew: 1,
        autoRenew: 20,
        plan: "6 Months",
        price: 60,
        paymentMethod: "Bank",
        subscribedAt: "2024-03-01",
        expiredAt: "2024-09-01",
    },
    {
        id: "3",
        accountId: "13",
        name: "Eddie Lake",
        email: "eddie@example.com",
        phone: "012345678",
        category: "Food",
        totalAds: 25,
        totalRenew: 3,
        autoRenew: 12,
        plan: "1 Year",
        price: 120,
        paymentMethod: "Credit Card",
        subscribedAt: "2024-01-01",
        expiredAt: "2025-01-01",
    },
    {
        id: "4",
        accountId: "14",
        name: "Sarah Chen",
        email: "sarah@example.com",
        phone: "098765432",
        category: "Services",
        totalAds: 10,
        totalRenew: 1,
        autoRenew: 20,
        plan: "6 Months",
        price: 60,
        paymentMethod: "Bank",
        subscribedAt: "2024-03-01",
        expiredAt: "2024-09-01",
    },
    {
        id: "5",
        accountId: "15",
        name: "Sarah Chen",
        email: "sarah@example.com",
        phone: "098765432",
        category: "General",
        totalAds: 10,
        totalRenew: 1,
        autoRenew: 20,
        plan: "6 Months",
        price: 60,
        paymentMethod: "Bank",
        subscribedAt: "2024-03-01",
        expiredAt: "2024-09-01",
    },
    {
        id: "6",
        accountId: "16",
        name: "Sarah Chen",
        email: "sarah@example.com",
        phone: "098765432",
        category: "Property",
        totalAds: 10,
        totalRenew: 1,
        autoRenew: 20,
        plan: "6 Months",
        price: 60,
        paymentMethod: "Bank",
        subscribedAt: "2024-03-01",
        expiredAt: "2024-09-01",
    },
]

export default function SubscriptionPage() {
    const [sub] = useState<Subscription[]>(initialSubscription)
    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const [subscription, setSubscription] = useState<Subscription[]>(initialSubscription)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedSubscriptions, setSelectedSubscriptions] = useState<string[]>([])
    const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [tab, setTab] = useState("all")

    const filteredSubscriptions = subscription.filter((sub) => {
        const q = searchQuery.toLowerCase()

        const matchesSearch =
            sub.id.toLowerCase().includes(q) ||
            sub.accountId.toLowerCase().includes(q) ||
            sub.name.toLowerCase().includes(q) ||
            sub.email.toLowerCase().includes(q) ||
            sub.category.toLowerCase().includes(q)

        const matchesTab =
            tab === "all"
                ? true
                : tab === "auto"
                    ? sub.category === "Auto"
                    : tab === "food"
                        ? sub.category === "Food"
                        : tab === "general"
                            ? sub.category === "General"
                            : tab === "property"
                                ? sub.category === "Property"
                                : tab === "services"
                                    ? sub.category === "Services"
                                    : true

        return matchesSearch && matchesTab
    })

    const totalPages = Math.ceil(filteredSubscriptions.length / rowsPerPage)
    const startIndex = (currentPage - 1) * rowsPerPage
    const paginatedSubscriptions = filteredSubscriptions.slice(startIndex, startIndex + rowsPerPage)
    const toggleSelectAll = () => {
        if (selectedSubscriptions.length === paginatedSubscriptions.length) {
            setSelectedSubscriptions([])
        } else {
            setSelectedSubscriptions(paginatedSubscriptions.map((u) => u.id))
        }
    }
    const handleDelete = () => {
        if (!selectedSubscription) return

        console.log("Deleted User:", selectedSubscription.id)

        setIsDeleteDialogOpen(false)
        setSelectedSubscription(null)
    }

    return (
        <main className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl text-sky-500 font-semibold">Users Subscription</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage subscription plans and users
                    </p>
                    <div className="relative w-80 pt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground mt-2" />
                        <Input
                            placeholder="Search..."
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
                                <TabsTrigger value="auto" className="cursor-pointer">
                                    Auto
                                    <Badge className="ml-1.5 px-1.5 py-0.5 text-xs">
                                        {sub.filter((sub) => sub.category === "Auto").length}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="food" className="cursor-pointer">
                                    Food
                                    <Badge className="ml-1.5 px-1.5 py-0.5 text-xs">
                                        {sub.filter((sub) => sub.category === "Food").length}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="general" className="cursor-pointer">
                                    General
                                    <Badge className="ml-1.5 px-1.5 py-0.5 text-xs">
                                        {sub.filter((sub) => sub.category === "General").length}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="property" className="cursor-pointer">
                                    Property
                                    <Badge className="ml-1.5 px-1.5 py-0.5 text-xs">
                                        {sub.filter((sub) => sub.category === "Property").length}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="services" className="cursor-pointer">
                                    Services
                                    <Badge className="ml-1.5 px-1.5 py-0.5 text-xs">
                                        {sub.filter((sub) => sub.category === "Services").length}
                                    </Badge>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>
            </div>
            {/* Table */}
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Account ID</TableHead>
                            <TableHead>Name / Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Total Ads</TableHead>
                            <TableHead>Total Renew</TableHead>
                            <TableHead>Auto Renew</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Payment</TableHead>
                            <TableHead>Subscribed</TableHead>
                            <TableHead>Expired</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Action</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {paginatedSubscriptions.map((sub) => {
                            const isExpired =
                                new Date(sub.expiredAt) < new Date()
                            return (
                                <TableRow key={sub.id}>
                                    <TableCell>{sub.id}</TableCell>
                                    <TableCell>{sub.accountId}</TableCell>

                                    <TableCell>
                                        <div>
                                            <div className="font-medium">{sub.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {sub.email}
                                            </div>
                                        </div>
                                    </TableCell>

                                    <TableCell>{sub.phone}</TableCell>

                                    <TableCell>
                                        <Badge variant="outline">{sub.category}</Badge>
                                    </TableCell>

                                    <TableCell>{sub.totalAds}</TableCell>
                                    <TableCell>{sub.totalRenew}</TableCell>
                                    <TableCell>
                                        {sub.autoRenew}
                                    </TableCell>

                                    <TableCell>{sub.plan}</TableCell>

                                    <TableCell>${sub.price}</TableCell>

                                    <TableCell>
                                        <Badge variant="secondary">
                                            {sub.paymentMethod}
                                        </Badge>
                                    </TableCell>

                                    <TableCell>
                                        {new Date(sub.subscribedAt).toLocaleDateString()}
                                    </TableCell>

                                    <TableCell>
                                        {new Date(sub.expiredAt).toLocaleDateString()}
                                    </TableCell>

                                    {/* Status */}
                                    <TableCell>
                                        <Badge
                                            className={
                                                isExpired
                                                    ? "text-red-500 border-red-500/30 bg-red-500/10"
                                                    : "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
                                            }
                                        >
                                            {isExpired ? "Expired" : "Active"}
                                        </Badge>
                                    </TableCell>

                                    {/* Actions */}
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button size="icon" variant="outline">
                                                    <MoreVertical className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem>
                                                    View
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive">
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t px-4 py-3">
                    {/* Rows per page */}
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

                    {/* Pagination Controls */}
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
                                onClick={() =>
                                    setCurrentPage((p) => Math.max(1, p - 1))
                                }
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="size-4" />
                            </Button>

                            <Button
                                variant="outline"
                                size="icon"
                                className="size-8"
                                onClick={() =>
                                    setCurrentPage((p) =>
                                        Math.min(totalPages, p + 1)
                                    )
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
                </div>{filteredSubscriptions.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground">
                        No subscriptions found
                    </div>
                )}
            </div>
        </main>
    )
}