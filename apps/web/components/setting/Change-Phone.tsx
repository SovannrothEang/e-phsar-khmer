
"use client"
import { Button } from "@/components/ui/button"
import {
    Field,
    FieldDescription,
    FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import SettingSidebar from "./SettingSidebar"
import { useState } from "react"
export default function EditProfile() {

    // ===== STATE =====
    const [phone, setPhone] = useState("")
    const [showPhone] = useState(false)
    const [touchedPhone, setTouchedPhone] = useState(false)
   


    // ===== VALIDATION =====
    const isPhoneInvalid =
        touchedPhone && phone.length < 10

    return (
        <div className="min-h-screen bg-muted pb-10 pt-4">
            <div className="max-w-6xl mx-auto  ">
                <div className="flex gap-5 ">
                    <SettingSidebar />
                    <main className="flex-1">
                        <div className="bg-card border border-border rounded-sm ">
                            <h1 className="text-2xl font-medium text-foreground  mb-4 mt-12 text-center ">Change Active Phone</h1>
                            <p className="text-center text-base w-full max-w-lg mx-auto mt-6 px-4">Please enter your phone number in the box below to verify your phone number.
                                We will send the verification code to your device.</p>

                            <Field className="w-full max-w-md mx-auto mt-6">
                                <FieldLabel className="text-sm text-foreground tracking-tight">
                                    Phone Number <span className="text-destructive">*</span>
                                </FieldLabel>
                                <Input
                                    type={showPhone ? "text" : "password"}
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    onBlur={() => setTouchedPhone(true)}
                                    placeholder="090000000"
                                    required
                                    aria-invalid={isPhoneInvalid}
                                />
                                {isPhoneInvalid && (
                                    <FieldDescription className="text-destructive">
                                        Please enter a valid phone number (at least 10 digits).
                                    </FieldDescription>
                                )}
                            </Field>
                            <div className="mx-auto w-full max-w-md mt-6 pb-10">
                                <Button disabled
                                    className="w-full bg-orange-500  py-4 hover:bg-orange-600 text-card rounded-sm"
                                >
                                    Submit
                                </Button>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    )
}