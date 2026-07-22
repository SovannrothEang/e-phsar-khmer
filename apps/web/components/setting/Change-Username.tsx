
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
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")

    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const [touchedPassword, setTouchedPassword] = useState(false)
    const [touchedConfirm, setTouchedConfirm] = useState(false)


    // ===== VALIDATION =====
    const isPasswordInvalid =
        touchedPassword && password.length < 8

    const isConfirmInvalid =
        touchedConfirm && confirmPassword !== password

    return (
        <div className="min-h-screen bg-muted pb-10 pt-4">
            <div className="max-w-6xl mx-auto  ">
                <div className="flex gap-5 ">
                    <SettingSidebar />
                    <main className="flex-1">
                        <div className="bg-card border border-border rounded-sm ">
                            <h1 className="text-2xl font-medium text-foreground  mb-4 mt-12 text-center ">Edit Username</h1>
                            <p className="text-center mb-6">You'll use this username to access your account.</p>

                            <Field className="w-full max-w-md mx-auto mt-6">
                                <FieldLabel className="text-sm text-foreground tracking-tight">
                                    Username <span className="text-destructive">*</span>
                                </FieldLabel>
                                <Input
                                    id="input-required"
                                    placeholder="Username"
                                    required
                                />
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