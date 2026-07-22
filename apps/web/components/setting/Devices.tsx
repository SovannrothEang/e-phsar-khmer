import { Button } from "@/components/ui/button"
import SettingSidebar from "./SettingSidebar"
import { Monitor, Smartphone, LogOut, Laptop } from "lucide-react"

export default function DeviceSettings() {
    return (
        <div className="min-h-screen bg-muted pb-10 pt-4">
            <div className="max-w-6xl mx-auto px-4">
                <div className="flex gap-5">
                    <SettingSidebar />

                    <main className="flex-1 space-y-6">
                        <h1 className="text-xl font-bold text-foreground">Devices</h1>

                        {/* THIS DEVICE SECTION */}
                        <section className="space-y-3">
                            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">This Device</h2>
                            <div className="bg-card border border-border rounded-sm overflow-hidden">
                                <div className="p-4 flex items-start gap-4">
                                    <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                                        <Monitor size={24} className="text-[#00a0e9]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-foreground">Chrome 147</h3>
                                        <p className="text-xs text-muted-foreground">Browser 2026.04.29</p>
                                        <div className="flex gap-2 mt-1">
                                            <span className="text-[10px] text-muted-foreground">Created: 28, Apr 2026</span>
                                            <span className="text-[10px] text-muted-foreground">•</span>
                                            <span className="text-[10px] text-muted-foreground">Last used: Just now</span>
                                        </div>
                                    </div>
                                </div>
                                <button className="w-full py-3 px-4 flex items-center gap-2 border-t border-border hover:bg-muted/50 transition-colors text-red-500 text-sm font-medium">
                                    <LogOut size={16} />
                                    Log out all other devices
                                </button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">Logs out all devices except this one.</p>
                        </section>

                        {/* OTHER DEVICES SECTION */}
                        <section className="space-y-3">
                            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Logins on other devices</h2>
                            <div className="bg-card border border-border rounded-sm divide-y divide-border">
                                
                                <DeviceItem 
                                    icon={<Laptop size={20} />} 
                                    name="Opera 130" 
                                    details="Browser 2026.04.25" 
                                    lastActive="29, Apr 2026" 
                                />

                                <DeviceItem 
                                    icon={<Smartphone size={20} />} 
                                    name="iPhone 18" 
                                    details="Browser 2026.04.25" 
                                    lastActive="27, Apr 2026" 
                                />

                                <DeviceItem 
                                    icon={<Monitor size={20} />} 
                                    name="Microsoft Edge 147" 
                                    details="Browser 2026.04.11" 
                                    lastActive="15, Apr 2026" 
                                />

                                <DeviceItem 
                                    icon={<Smartphone size={20} />} 
                                    name="iPhone" 
                                    details="App 2025.12.05" 
                                    lastActive="26, Jan 2026" 
                                />

                                <DeviceItem 
                                    icon={<Laptop size={20} />} 
                                    name="Unknown" 
                                    details="" 
                                    lastActive="28, Dec 2025" 
                                />
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </div>
    )
}

// Sub-component for individual device rows
function DeviceItem({ icon, name, details, lastActive }: { icon: React.ReactNode, name: string, details: string, lastActive: string }) {
    return (
        <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
                    {icon}
                </div>
                <div>
                    <h3 className="text-sm font-bold text-foreground">{name}</h3>
                    {details && <p className="text-xs text-muted-foreground">{details}</p>}
                    <p className="text-[11px] text-muted-foreground">Last active: {lastActive}</p>
                </div>
            </div>
            <button className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors">
                <LogOut size={18} />
            </button>
        </div>
    )
}