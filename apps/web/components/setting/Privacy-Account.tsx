"use client"
import * as React from "react"
import { Lock, Globe } from "lucide-react"
import SettingSidebar from "./SettingSidebar"
import { Switch } from "@/components/ui/switch"

interface PrivacyRowProps {
    title: string;
    initialState?: boolean;
}
const PrivacyRow = ({ title, initialState = false }: PrivacyRowProps) => {
    const [isPublic, setIsPublic] = React.useState(initialState);

    return (
        <div className="flex items-center justify-between p-4 bg-muted rounded-sm transition-all">
            <div className="space-y-1">
              
                <p className="text-sm text-card-foreground/80 font-medium">{title}</p>

               
                <div className="flex items-center gap-1.5">
                    {isPublic ? (
                        <>
                            <Globe size={16} className="text-[#00a0e9]" />
                            <span className="text-sm text-[#00a0e9]">Public</span>
                        </>
                    ) : (
                        <>
                            <Lock size={16} className="text-[#00a0e9]" />
                            <span className="text-sm text-[#00a0e9]">Only Me</span>
                        </>
                    )}
                </div>
            </div>

            <Switch
                checked={isPublic}
                onCheckedChange={setIsPublic}
                className="data-[state=checked]:bg-[#00a0e9] data-[state=unchecked]:bg-gray-300 scale-120"
            />
        </div>
    );
};
export default function AccountPrivacy() {

    return (
        <div className="min-h-screen bg-muted pb-10 pt-4">
            <div className="max-w-6xl mx-auto  ">
                <div className="flex gap-5 ">
                    <SettingSidebar />
                    <main className="flex-1">
                        <div className="bg-card border border-border rounded-sm">
                            <div>
                                <h2 className="text-2xl font-medium text-foreground mb-4 mt-6 px-6">Privacy</h2>

                                <div className="px-6 pb-6 space-y-3">
                                    <PrivacyRow title="Who can look you up using the Gender you provided?" initialState={false} />
                                    <PrivacyRow title="Who can look you up using the Date Of Birth you provided?" initialState={false}/>
                                    <PrivacyRow title="Who can look you up using the Phone you provided?" initialState={true} />
                                    <PrivacyRow title="Who can look you up using the Email you provided?" initialState={true} />
                                    <PrivacyRow title="Who can look you up using the Location you provided?" initialState={true} />
                                </div>
                            </div>
                        </div>

                    </main>
                </div>
            </div>
        </div>
    )
}