
import { Button } from "@/components/ui/button"

import SettingSidebar from "./SettingSidebar"
import Link from "next/link"
import { UserRoundKey, Plus } from "lucide-react"


export default function PasskeySettings() {


    return (
        <div className="min-h-screen bg-muted pb-10 pt-4">
            <div className="max-w-6xl mx-auto  ">
                <div className="flex gap-5 ">
                    <SettingSidebar />
                    <main className="flex-1">
                        <div className="bg-card border border-border rounded-sm">
                            <h1 className="text-xl font-medium text-foreground mb-4 mt-6 px-4">Passkeys</h1>
                            <div className="mt-2 px-4 space-y-4">
                                <div className="flex items-start gap-3 p-4 bg-[#00a0e9]/5  rounded-sm">
                                    <div className="flex-shrink-0 pt-1">
                                        <UserRoundKey size={20} className="text-[#00a0e9]" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[14px] leading-relaxed text-card-foreground">
                                            Passkeys are a safer and easier replacement for passwords. You can use them to sign in to your account without typing a password.
                                        </p>
                                    </div>
                                </div>

                                <Button className="bg-[#00a0e9]/80 hover:bg-[#00a0e9]/60 text-card rounded-sm w-full h-10 cursor-pointer">
                                    <Plus size={18} className="block mr-1 text-lg" />
                                    <span className="text-sm">Add a Passkey</span>
                                </Button>

                                <div className=" text-center text-sm text-muted-foreground pb-6">
                                    <p>You can have multiple passkeys for different devices.</p>
                                </div>
                            </div>
                        </div>

                    </main>
                </div>
            </div>
        </div>
    )
}