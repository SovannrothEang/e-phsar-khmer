"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator"
import { Link } from "@/i18n/routing"
import { ChevronRight } from "lucide-react"
import { Field, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import Image from "next/image"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"


export default function Settings() {
    const [autoUpdate, setAutoUpdate] = useState(false);
    return (
        <div className="min-h-screen bg-muted pb-30 pt-2">
            <div className="max-w-6xl mx-auto px-4 ">
                <main className="max-w-4xl mx-auto px-4">
                    <h1 className="text-2xl font-medium text-foreground mb-4 mt-2">Settings</h1>

                    <Link
                        href={{ pathname: "/settings/edit-profile" }}
                        className="flex items-center justify-between p-2 bg-card hover:bg-background/50 rounded-sm border border-transparent hover:border-border"
                    >
                        <div className="flex items-center gap-4 px-2">
                            <Image
                                src="/avatar/sayi.png"
                                width={100}
                                height={100}
                                alt="Profile picture of Thuch Sayi"
                                priority
                                className="rounded-full  border border-gray-100 object-cover size-[50px] aspect-square flex-shrink-0"
                            />
                            <div>
                                <p className="font-medium text-foreground">Thuch Sayi</p>
                                <p className="text-sm text-muted-foreground">@thuchsayi</p>
                            </div>
                        </div>
                        <ChevronRight size={24} className="text-gray-300" />
                    </Link>
                    <div className="mt-4">
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Account</h3>
                        <Link
                            href={{ pathname: "/settings/edit-profile" }}
                            className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-t-lg border border-transparent hover:border-border"
                        >
                            <p className="px-1">Edit Profile</p>
                            <p className="flex items-center opacity-50 gap-1">
                                <ChevronRight size={24} className="text-gray-300" />
                            </p>
                        </Link>
                        <Separator />
                        <Link
                            href={{ pathname: "/settings/change-password" }}
                            className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
                        >
                            <p className="px-1">Change Password</p>
                            <p className="flex items-center opacity-50 gap-1">
                                <ChevronRight size={24} className="text-gray-300" />
                            </p>
                        </Link>
                        <Separator />
                        <Link
                            href={{ pathname: "/settings/change-username" }}
                            className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
                        >
                            <p className="px-1">Username</p>
                            <p className="flex items-center opacity-50 gap-1">thuchsayi
                                <ChevronRight size={24} className="text-gray-300" />
                            </p>
                        </Link>
                        <Separator />
                        <Link
                            href={{ pathname: "/settings/change-phone" }}
                            className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
                        >
                            <p className="px-1">Activate Phone</p>
                            <p className="flex items-center opacity-50 gap-1">09666166394
                                <ChevronRight size={24} className="text-gray-300" />
                            </p>
                        </Link>
                        <Separator />
                        <Link
                            href={{ pathname: "/membership" }}
                            className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
                        >
                            <p className="px-1">Facebook</p>
                            <p className="flex items-center opacity-50 gap-1 capitalize">thuch sayi
                                <ChevronRight size={24} className="text-gray-300" />
                            </p>
                        </Link>
                        <Separator />
                        <Link
                            href={{ pathname: "/membership" }}
                            className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
                        >
                            <p className="px-1">Google</p>
                            <p className="flex items-center opacity-50 gap-1 capitalize">thuch sayi
                                <ChevronRight size={24} className="text-gray-300" />
                            </p>
                        </Link>
                        <Separator />
                        <Link
                            href={{ pathname: "/membership" }}
                            className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
                        >
                            <p className="px-1">Telegram</p>
                            <p className="flex items-center opacity-50 capitalize gap-1">Add
                                <ChevronRight size={24} className="text-gray-300" />
                            </p>
                        </Link>
                        <Separator />
                        <Link
                            href={{ pathname: "/settings/passkeys" }}
                            className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
                        >
                            <p className="px-1">Passkeys</p>
                            <p className="flex items-center opacity-50 capitalize gap-1">
                                <ChevronRight size={24} className="text-gray-300" />
                            </p>
                        </Link>
                        <Separator />
                        <Link
                            href={{ pathname: "/settings/devices" }}
                            className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
                        >
                            <p className="px-1">Devices</p>
                            <p className="flex items-center opacity-50 capitalize gap-1">
                                <ChevronRight size={24} className="text-gray-300" />
                            </p>
                        </Link>
                        <Separator />
                        <Field
                            orientation="horizontal"
                            onClick={() => {
                                toast.promise<{ name: string }>(
                                    () => new Promise((resolve) => setTimeout(() => resolve({ name: "Your store" }), 2000)),
                                    {
                                        loading: "Loading...",
                                        success: (data) => `${data.name} setting has been saved successfully`,
                                        position: "top-right",
                                        error: "Error",
                                    }
                                );
                                setAutoUpdate(!autoUpdate);
                            }}
                            className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border cursor-pointer transition-colors"
                        >
                            <FieldLabel className="px-1 font-normal text-base cursor-pointer">
                                Auto Update Profile Picture
                            </FieldLabel>

                            <Switch
                                checked={autoUpdate}
                                onCheckedChange={setAutoUpdate}
                                className="data-[state=checked]:bg-[#00a0e9] data-[state=unchecked]:bg-input scale-120 mr-2"
                            />
                        </Field>
                        <Separator />
                        <Dialog>
                            <DialogTrigger asChild>
                                <button className="w-full flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border cursor-pointer">
                                    <p className="px-1 ">Delete Account</p>
                                </button>
                            </DialogTrigger>

                            <DialogContent className="sm:max-w-[550px] rounded-md p-6">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold text-foreground">
                                        thouchsayi: Delete Account?
                                    </DialogTitle>
                                    <DialogDescription className="mt-4 text-[15px] leading-relaxed text-foreground/90">
                                        Your account will be deactivated and won&apos;t be visible to the
                                        public. During deactivation, you can reactivate your account
                                        anytime. After 90 days, your data will be deleted permanently.
                                    </DialogDescription>
                                </DialogHeader>

                                <DialogFooter className="flex flex-row justify-end gap-3 mt-6">
                                    <DialogClose asChild>
                                        <Button
                                            variant="ghost"
                                            className="bg-[#eeeeee] hover:bg-gray-200 text-black px-6 rounded-sm font-medium cursor-pointer"
                                        >
                                            Cancel
                                        </Button>
                                    </DialogClose>

                                    <Button
                                        type="submit"
                                        className="bg-[#e3281b] hover:bg-red-700 text-white px-8 rounded-sm font-medium cursor-pointer"
                                    >
                                        Next
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Separator />
                        <Link
                            href={{ pathname: "/settings/privacy" }}
                            className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
                        >
                            <p className="px-1">Privacy</p>
                            <p className="flex items-center opacity-50 gap-1">
                                <ChevronRight size={24} className="text-gray-300" />
                            </p>
                        </Link>
                        <Separator />
                        <Link
                            href={{ pathname: "/membership" }}
                            className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
                        >
                            <p className="px-1">Membership Information</p>
                            <p className="flex items-center opacity-50 gap-1">
                                <ChevronRight size={24} className="text-gray-300" />
                            </p>
                        </Link>
                        <Separator />
                        <Link
                            href={{ pathname: "/billing-addresses" }}
                            className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-b-lg border border-transparent hover:border-border"
                        >
                            <p className="px-1">Billing Address</p>
                            <p className="flex items-center opacity-50 gap-1">
                                <ChevronRight size={24} className="text-gray-300" />
                            </p>
                        </Link>
                        <div className="mt-4">
                            <Dialog >
                                <DialogTrigger asChild>
                                    <Button
                                        className="flex w-full items-center justify-center p-2.5 h-10 bg-card hover:bg-red-700/90 rounded-full border border-transparent hover:border-red-500/20 group transition-colors cursor-pointer"
                                    >
                                        <p className="text-red-500 font-medium group-hover:text-white">Sign Out</p>
                                    </Button>
                                </DialogTrigger>

                                <DialogContent className="sm:max-w-[600px] rounded-sm">
                                    <DialogHeader>
                                        <DialogTitle className="text-lg font-semibold">Sign Out</DialogTitle>
                                        <DialogDescription className="mt-2 text-base text-muted-foreground">
                                            Are you sure that you want to sign out from your account?
                                        </DialogDescription>
                                    </DialogHeader>

                                    <DialogFooter className="flex flex-row gap-2 mt-4">
                                        <DialogClose asChild>
                                            <Button
                                                variant="ghost"
                                                className="flex-1 border border-border hover:bg-card cursor-pointer"
                                            >
                                                Cancel
                                            </Button>
                                        </DialogClose>

                                        <form action="/" method="POST" className="flex-1">
                                            <Button
                                                type="submit"
                                                className="w-full bg-red-500  hover:bg-red-600 text-white font-medium cursor-pointer"
                                            >
                                                Sign Out
                                            </Button>
                                        </form>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

