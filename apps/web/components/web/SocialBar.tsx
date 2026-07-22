'use client'
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import { IconBellFilled, IconMessageFilled, IconFolderOpen, IconHeart, IconBookmark, IconBriefcase, IconClipboardList, IconId, IconCreditCard, IconSettings } from '@tabler/icons-react';
import { FaCamera } from "react-icons/fa";
import { ChartNoAxesCombined, LogOut } from 'lucide-react';
import { useState } from "react";
import { Link, useRouter } from "@/i18n/routing";

export function SocialBar() {
    
    const [open, setOpen] = useState(false);
    const router = useRouter();
    return (
        <div className="flex items-center gap-3">
            {/* Notifications */}
            <Button variant={"ghost"}
            onClick={() => router.push("/notifications")}
             className="relative bg-card rounded-full h-10 w-10 border border-muted-foreground/50 text-muted-foreground hover:text-gray-700 transition-colors cursor-pointer">
                <IconBellFilled className="scale-150 " />
                {/* <span className="absolute top-0 right-0 flex h-[10px] w-[10px] items-center justify-center rounded-full bg-[#f04d4e] text-[10px] font-bold text-white border-2 border-white">
                    4
                </span> */}
            </Button>
            {/* Messages */}
            <Button variant={"ghost"} 
            onClick={() => router.push("/chats")}
            className="relative bg-card rounded-full h-10 w-10 border border-muted-foreground/50 text-muted-foreground hover:text-gray-700 transition-colors cursor-pointer">
            
                <IconMessageFilled className="scale-150" />
            </Button>
            {/* User Dropdown */}
            <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
                <DropdownMenuTrigger className="outline-none ml-2">
                    <div className="relative h-10 w-10 rounded-full overflow-hidden border border-muted-foreground/50 cursor-pointer">
                        <Image src="https://ui-avatars.com/api/?name=Thouch+Sayi&background=00a0e9&color=fff"
                            width={36}
                            height={36}
                            alt="User" className="w-full h-full object-cover" />
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-[280px] p-0 shadow-xl rounded-md border border-muted-foreground/20 shadow-md mt-2 ">
                    <div className="py-2">
                        <DropdownMenuItem className="flex items-center gap-3 px-3 py-2.5 cursor-pointer">
                            <div className="flex items-center gap-3 rounded-t-md">
                                <div className="h-12 w-12 rounded-full overflow-hidden border border-[#00a0e9] flex-shrink-0">
                                    <Image src="https://ui-avatars.com/api/?name=Thouch+Sayi&background=00a0e9&color=fff"
                                        width={50}
                                        height={50}
                                        alt="User" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-base font-medium text-[#00a0e9]">Thouch Sayi</span>
                                    <span className="text-xs text-muted-foreground">@thouchsayi</span>
                                </div>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="flex items-center gap-3 px-5 py-2.5 cursor-pointer text-gray-700 hover:bg-gray-50 outline-none">
                            <IconFolderOpen className="scale-150 text-muted-foreground" strokeWidth={1.5} />
                            <span className="text-sm text-foreground font-medium">My Ads</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 px-5 py-2.5 cursor-pointer text-gray-700 hover:bg-gray-50 outline-none">
                            <IconHeart className="scale-150 text-muted-foreground" strokeWidth={1.5} />
                            <span className="text-sm text-foreground font-medium">Likes</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 px-5 py-2.5 cursor-pointer text-gray-700 hover:bg-gray-50 outline-none">
                            <IconBookmark className="scale-150 text-muted-foreground" strokeWidth={1.5} />
                            <span className="text-sm text-foreground font-medium">Saved</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="flex items-center gap-3 px-5 py-2.5 cursor-pointer text-gray-700 hover:bg-gray-50 outline-none">
                            <IconBriefcase className="scale-150 text-muted-foreground" strokeWidth={1.5} />
                            <span className="text-sm text-foreground font-medium">Applied Jobs</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 px-5 py-2.5 cursor-pointer text-gray-700 hover:bg-gray-50 outline-none">
                            <IconClipboardList className="scale-150 text-muted-foreground" strokeWidth={1.5} />
                            <span className="text-sm text-foreground font-medium">Job Applications</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 px-5 py-2.5 cursor-pointer text-gray-700 hover:bg-gray-50 outline-none">
                            <IconId className="scale-150 text-muted-foreground" strokeWidth={1.5} />
                            <span className="text-sm text-foreground font-medium">Resume (CV)</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="flex items-center gap-3 px-5 py-2.5 cursor-pointer text-gray-700 hover:bg-gray-50 outline-none">
                            <IconCreditCard className="scale-150 text-muted-foreground" strokeWidth={1.5} />
                            <span className="text-sm text-foreground font-medium">Subscriptions</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="flex items-center gap-3 px-5 py-2.5 cursor-pointer text-gray-700 hover:bg-gray-50 outline-none">
                            <ChartNoAxesCombined className="scale-150 text-muted-foreground" strokeWidth={1.5} />
                            <span className="text-[14px] text-foreground font-medium">Insight</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="flex items-center gap-3 px-5 py-2.5 cursor-pointer text-gray-700 hover:bg-gray-50 outline-none">
                            <IconSettings className="scale-150 text-muted-foreground" strokeWidth={1.5} />
                            <span className="text-[14px] text-foreground font-medium">Settings</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => { router.push("/login") }}
                            className="flex items-center gap-3 px-5 py-2.5 cursor-pointer text-gray-700 hover:bg-gray-50 outline-none">
                            <LogOut className="scale-150 text-muted-foreground" strokeWidth={1.5} />
                            <span className="text-sm text-foreground font-medium">Sign out</span>
                        </DropdownMenuItem>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
            <Button
                asChild
                variant="ghost"
                className="h-[42px] bg-[#f68b1e] text-white px-6 text-base font-medium rounded transition-colors hover:bg-[#f68b1e]/80 hover:text-white"
            >
                <Link href={`/post`}>
                    <FaCamera className="scale-120" strokeWidth={2.5} />
                    Sell
                </Link>
            </Button>
        </div>
    );
}