"use client";

import { useState } from "react";
import { RefreshCwIcon, ArrowLeft } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Link, useRouter } from "@/i18n/routing";

type OtpVerifyFormProps = {
  phone: string;
};

export function OtpVerifyForm({ phone }: OtpVerifyFormProps) {
  const [value, setValue] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (value.length < 6) {
      toast.error("Please enter the complete 6-digit verification code.");
      return;
    }

    if (value === "123456") {
      toast.success("Phone number verified successfully!", {
        position: "top-right",
      });
      router.push("/login");
    } else {
      toast.error("Invalid verification code. Please try again.");
    }
  };

  if (!phone.trim()) {
    return (
      <Card className="mx-auto max-w-md w-full bg-card p-2">
        <CardHeader>
          <CardTitle>Verify your phone</CardTitle>
          <CardDescription>
            No phone number to verify. Please register first.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            type="button"
            onClick={() => router.push("/register")}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white h-10 cursor-pointer"
          >
            Go back to register
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md w-full bg-card p-2">
      <CardHeader>
        <div className="flex items-center gap-2 mb-1">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => router.push("/register")}
            className="h-8 w-8 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle>Verify your phone</CardTitle>
        </div>
        <CardDescription>
          We sent a 6-digit verification code to{" "}
          <span className="font-medium">{phone}</span>. Enter it below to
          complete your registration. (Demo code: 123456)
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent>
          <Field>
            <div className="flex items-center justify-between mb-2">
              <FieldLabel htmlFor="otp-verification">
                Verification code
              </FieldLabel>
              <Button
                variant="outline"
                size="xs"
                type="button"
                onClick={() =>
                  toast.success("Code resent successfully!", {
                    position: "top-right",
                  })
                }
              >
                <RefreshCwIcon className="mr-1 h-3 w-3" />
                Resend Code
              </Button>
            </div>

            <div className="flex justify-center py-2">
              <InputOTP
                maxLength={6}
                id="otp-verification"
                value={value}
                onChange={(newValue) => setValue(newValue)}
                required
              >
                <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:text-xl">
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </Field>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white h-10 cursor-pointer"
          >
            Verify
          </Button>
          <div className="text-sm text-muted-foreground text-center">
            Wrong number?{" "}
            <Link
              href="/register"
              className="underline underline-offset-4 transition-colors hover:text-primary"
            >
              Go back to register
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
