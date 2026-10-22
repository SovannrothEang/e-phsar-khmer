"use client";

import { loginSchema } from "@/schemas/login";
import { useAppForm } from "@/components/form/hooks";
import { login } from "@/actions/login";
import { requestLoginOtp } from "@/actions/otp";
import { isLocalPhone, normalizePhone } from "@/lib/phone";
import { getDeviceIdentity } from "@/lib/device";
import { storeOtpRegistration } from "@/lib/otp-registration";
import { toast } from "@/components/ui/sonner";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FieldDescription,
  FieldGroup,
  FieldSeparator,
} from "@/components/ui/field";
import { FcGoogle } from "react-icons/fc";
import { FaFacebook, FaApple, FaTelegramPlane } from "react-icons/fa";
import { Link, useRouter } from "@/i18n/routing";

type FormData = z.infer<typeof loginSchema>;

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();

  const form = useAppForm({
    defaultValues: {
      login: "",
      password: "",
    } satisfies FormData as FormData,
    validators: {
      onSubmit: loginSchema,
      onChange: loginSchema,
    },
    onSubmit: async ({ value }) => {
      // Phone identifiers (local 0… format) log in via OTP — the backend
      // validates the password first and only then sends the code.
      if (isLocalPhone(value.login)) {
        const phone = normalizePhone(value.login);
        if (!phone) {
          toast.error("Invalid phone number.");
          return;
        }
        const result = await requestLoginOtp(phone, value.password);
        if (result.success) {
          storeOtpRegistration({
            mode: "login",
            phone,
            password: value.password,
          });
          toast.success("Code sent to your phone.", { position: "top-right" });
          router.push({ pathname: "/otp", query: { phone } });
        } else {
          toast.error(result.error || "Login failed.");
        }
        return;
      }

      const device = getDeviceIdentity();
      const result = await login(value, device ?? undefined);

      if (result.success) {
        form.reset();
        toast.success("Login successfully!", { position: "top-right" });
        router.push("/me");
      } else {
        toast.error(result.error || "Login failed.");
      }
    },
  });

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0 bg-card rounded-sm">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form
            className="p-6 md:p-8"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-xl font-medium">
                  Login to manage ads or post free ad
                </h1>
              </div>

              <form.AppField name="login">
                {(field) => (
                  <field.Input
                    label="Phone Number, Username or Email"
                    required={true}
                  />
                )}
              </form.AppField>

              <form.AppField name="password">
                {(field) => (
                  <field.Input
                    label="Password"
                    type="password"
                    required={true}
                  />
                )}
              </form.AppField>

              <Link
                href="/forgot-password"
                className="inline-block text-right text-sm underline-offset-2 hover:underline"
              >
                Forgot Password / Account
              </Link>

              <Button
                type="submit"
                className="h-10 w-full rounded-sm bg-orange-500 hover:bg-orange-600 text-white cursor-pointer"
              >
                Login
              </Button>

              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>

              <Button
                type="button"
                className="h-10 w-full rounded-sm bg-sky-500 hover:bg-sky-600 text-white cursor-pointer"
              >
                <div className="flex items-center justify-center rounded-full bg-sky-400 w-6 h-6">
                  <FaTelegramPlane className="text-white" />
                </div>
                Sign In or register with Telegram
              </Button>

              <div className="grid grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  type="button"
                  className="h-10 !w-full rounded-lg cursor-pointer"
                >
                  <FaFacebook className="text-blue-500 scale-150" />
                  <span className="sr-only">Login with Meta</span>
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  className="h-10 !w-full rounded-lg cursor-pointer"
                >
                  <FcGoogle className="h-5 w-5 scale-150" />
                  <span className="sr-only">Login with Google</span>
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  className="h-10 !w-full rounded-lg cursor-pointer"
                >
                  <FaApple className="h-5 w-5 scale-150" />
                  <span className="sr-only">Login with Apple</span>
                </Button>
              </div>

              <FieldDescription className="text-center">
                Don&apos;t have an account?{" "}
                <Link href="/register">Sign up</Link>
              </FieldDescription>
            </FieldGroup>
          </form>
          <div className="relative hidden bg-muted md:block">
            {/* eslint-disable-next-line @next/next/no-img-element -- static placeholder */}
            <img
              src="/placeholder.svg"
              alt="Image"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By continue, you agree to our{" "}
        <Link
          href="/posting-rule"
          className="hover:text-blue-500 hover:underline cursor-pointer"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy-policy"
          className="hover:text-blue-500 hover:underline cursor-pointer"
        >
          Privacy Policy
        </Link>
        .
      </FieldDescription>
    </div>
  );
}
