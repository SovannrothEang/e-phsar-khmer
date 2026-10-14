"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CircleAlert,
  Clock3,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Link } from "@/i18n/routing";
import {
  createSubscriptionCheckout,
  getMySubscriptions,
  getPaymentTransactionStatus,
  getSubscriptionCatalog,
  type PaymentTransactionStatus,
  type SubscriptionCatalogItem,
} from "@/actions/subscriptions";
import { Button } from "@/components/ui/button";

// ~7 minutes at 2.5s — longer than the 5 minute KHQR lifetime, so the page
// never stops watching a code that could still be paid.
const MAX_POLLS = 170;

function priceFor(item: SubscriptionCatalogItem): number {
  const price = Number(item.price);
  const discount = Number(item.discount);
  const final =
    item.discountType === "percent"
      ? price * (1 - discount / 100)
      : price - discount;
  return Math.max(0, Math.round(final * 100) / 100);
}

function money(value: string | number): string {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getQr(
  rawResponse: unknown,
): { qr: string; expiresAt: number | null } | null {
  if (!rawResponse || typeof rawResponse !== "object") return null;
  const { qr, expiresAt } = rawResponse as {
    qr?: unknown;
    expiresAt?: unknown;
  };
  if (typeof qr !== "string") return null;
  return { qr, expiresAt: typeof expiresAt === "number" ? expiresAt : null };
}

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function CheckoutPage() {
  const params = useSearchParams();
  const termId = params.get("termId");
  const [catalog, setCatalog] = useState<SubscriptionCatalogItem[]>([]);
  const [payment, setPayment] = useState<PaymentTransactionStatus | null>(null);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const idempotencyKey = useRef<string | null>(null);
  const pollCount = useRef(0);

  useEffect(() => {
    let mounted = true;
    getSubscriptionCatalog()
      .then((items) => {
        if (mounted) setCatalog(items);
      })
      .catch(() => {
        if (mounted)
          setError(
            "We couldn't load this offer. Please go back and try again.",
          );
      })
      .finally(() => {
        if (mounted) setLoadingCatalog(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const offer = useMemo(
    () => catalog.find((item) => item.termId === termId),
    [catalog, termId],
  );

  async function startCheckout() {
    if (!offer) return;
    setStartingCheckout(true);
    setError(null);
    idempotencyKey.current ??= crypto.randomUUID();
    const result = await createSubscriptionCheckout({
      termId: offer.termId,
      idempotencyKey: idempotencyKey.current,
    });
    setStartingCheckout(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setPurchaseId(result.data.purchaseId);
    setActivated(false);
    setPayment({
      id: result.data.paymentTransactionId,
      status: "pending",
      amount: result.data.amount,
      currency: result.data.currency,
      checkout: null,
    });
  }

  function retryCheckout() {
    setPayment(null);
    setPurchaseId(null);
    setActivated(false);
    setError(null);
    idempotencyKey.current = crypto.randomUUID();
  }

  const paymentId = payment?.id;

  useEffect(() => {
    if (!paymentId || !purchaseId) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (cancelled) return;
      if (pollCount.current >= MAX_POLLS) {
        setError(
          "We're still waiting for confirmation. If you already paid, check My subscriptions in a moment.",
        );
        return;
      }
      pollCount.current += 1;
      const result = await getPaymentTransactionStatus(paymentId);
      if (cancelled) return;
      if (!result.success) {
        setError(`${result.error}; retrying…`);
        timeout = setTimeout(poll, 2500);
        return;
      }

      setError(null);
      setPayment(result.data);
      if (result.data.status === "succeeded") {
        try {
          const subscriptions = await getMySubscriptions();
          if (
            subscriptions.some(
              (subscription) =>
                subscription.purchaseId === purchaseId &&
                subscription.status === "active",
            )
          ) {
            setActivated(true);
            return;
          }
        } catch {
          // Keep polling activation status through temporary API failures.
        }
      } else if (
        result.data.status !== "pending" &&
        result.data.status !== "processing"
      ) {
        return;
      }

      timeout = setTimeout(poll, 2500);
    };

    pollCount.current = 0;
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [paymentId, purchaseId]);

  const qrInfo = getQr(payment?.checkout?.rawResponse);
  const waitingForPayment =
    !!payment &&
    !activated &&
    (payment.status === "pending" || payment.status === "processing");

  useEffect(() => {
    if (!waitingForPayment || !qrInfo?.expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waitingForPayment, qrInfo?.expiresAt]);

  const remainingMs = qrInfo?.expiresAt ? qrInfo.expiresAt - now : null;
  const paymentFailed =
    payment?.status === "failed" ||
    payment?.status === "cancelled" ||
    payment?.status === "expired";
  const step = activated ? 3 : payment ? 2 : 1;
  const planPrice = offer ? priceFor(offer) : 0;
  const dueToday = payment ? Number(payment.amount) : planPrice;
  const credit = payment && planPrice > dueToday ? planPrice - dueToday : 0;

  return (
    <div className="min-h-screen bg-muted pb-16">
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        <Link
          href={
            offer
              ? {
                  pathname: "/premium-account/[category]",
                  params: { category: offer.categorySlug },
                }
              : "/premium-account"
          }
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to plans
        </Link>

        <div className="mt-3 mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Checkout
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review your plan, then pay with Bakong KHQR.
            </p>
          </div>
          <ol className="flex items-center gap-3 text-sm" aria-label="Progress">
            {["Review", "Pay", "Active"].map((label, index) => {
              const number = index + 1;
              const done = number < step || (number === 3 && activated);
              const current = number === step && !done;
              return (
                <li key={label} className="flex items-center gap-3">
                  <span className="flex items-center gap-2">
                    <span
                      className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                        done
                          ? "bg-emerald-600 text-white"
                          : current
                            ? "bg-[#00a0e9] text-white"
                            : "bg-card text-muted-foreground ring-1 ring-border"
                      }`}
                    >
                      {done ? <Check className="size-3.5" /> : number}
                    </span>
                    <span
                      className={
                        current
                          ? "font-medium text-foreground"
                          : "hidden text-muted-foreground sm:inline"
                      }
                    >
                      {label}
                    </span>
                  </span>
                  {index < 2 && (
                    <span
                      aria-hidden
                      className="hidden h-px w-6 bg-border sm:block"
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2 rounded-xl bg-card p-4 text-sm text-destructive ring-1 ring-destructive/30"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
          </div>
        )}

        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border sm:p-8">
            {loadingCatalog ? (
              <div className="h-72 animate-pulse rounded-xl bg-muted" />
            ) : !offer ? (
              <div className="flex min-h-72 flex-col items-center justify-center text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                  <CircleAlert className="size-6" />
                </span>
                <h2 className="mt-4 font-semibold text-foreground">
                  Offer unavailable
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This term may have been removed or deactivated.
                </p>
                <Link
                  href="/premium-account"
                  className="mt-4 text-sm font-medium text-[#0089c8] hover:underline"
                >
                  Browse available plans
                </Link>
              </div>
            ) : activated ? (
              <div className="flex min-h-72 flex-col items-center justify-center text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <BadgeCheck className="size-8" />
                </span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                  You&apos;re all set
                </h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Payment confirmed and your {offer.packageName} package is
                  ready to use.
                </p>
                <Link
                  href="/me/subscriptions"
                  className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#00a0e9] px-5 text-sm font-semibold text-white hover:bg-[#008ccb]"
                >
                  View my subscriptions <ArrowRight className="size-4" />
                </Link>
              </div>
            ) : paymentFailed ? (
              <div className="flex min-h-72 flex-col items-center justify-center text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                  <CircleAlert className="size-8" />
                </span>
                <h2 className="mt-4 text-xl font-semibold text-foreground">
                  Payment didn&apos;t complete
                </h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  The code expired or the payment wasn&apos;t received, so no
                  subscription was activated. Start a new checkout to try again.
                </p>
                <Button
                  onClick={retryCheckout}
                  className="mt-6 h-11 rounded-xl bg-[#00a0e9] px-6 text-white hover:bg-[#008ccb]"
                >
                  Try again
                </Button>
              </div>
            ) : payment?.status === "succeeded" ? (
              <div className="flex min-h-72 flex-col items-center justify-center text-center">
                <span className="size-10 animate-spin rounded-full border-2 border-border border-t-emerald-600" />
                <h2 className="mt-5 text-xl font-semibold text-foreground">
                  Payment received
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Activating your subscription — this page updates by itself.
                </p>
              </div>
            ) : payment ? (
              <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_240px] sm:items-center">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <Clock3 className="size-3.5" />
                    {remainingMs !== null
                      ? `Expires in ${clock(remainingMs)}`
                      : "Waiting for payment"}
                  </span>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                    Scan to pay{" "}
                    <span className="tabular-nums">
                      ${money(payment.amount)}
                    </span>
                  </h2>
                  <ol className="mt-5 space-y-3 text-sm text-foreground">
                    {[
                      "Open Bakong or a supported banking app",
                      "Scan the KHQR code",
                      "Confirm the amount and approve",
                    ].map((text, index) => (
                      <li key={text} className="flex items-center gap-3">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {index + 1}
                        </span>
                        {text}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-5 text-xs text-muted-foreground">
                    Keep this page open — it confirms automatically.
                  </p>
                </div>
                <div className="mx-auto w-full max-w-[240px] rounded-2xl bg-white p-4 ring-1 ring-border">
                  {qrInfo ? (
                    <QRCodeSVG
                      value={qrInfo.qr}
                      size={208}
                      level="M"
                      className="h-auto w-full"
                    />
                  ) : (
                    <div className="flex aspect-square flex-col items-center justify-center text-center">
                      <span className="size-7 animate-spin rounded-full border-2 border-border border-t-[#00a0e9]" />
                      <p className="mt-3 text-xs text-neutral-500">
                        Preparing your QR code…
                      </p>
                    </div>
                  )}
                  <p className="mt-3 text-center text-[11px] font-medium tracking-wide text-neutral-500">
                    BAKONG KHQR
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-[#00a0e9]/10 text-[#0089c8]">
                  <ScanLine className="size-7" />
                </span>
                <h2 className="mt-4 text-xl font-semibold text-foreground">
                  Ready when you are
                </h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Continue to create your payment request. Your KHQR code
                  appears right here.
                </p>
              </div>
            )}
          </section>

          <aside className="rounded-2xl bg-card shadow-sm ring-1 ring-border md:sticky md:top-20">
            <div className="p-6">
              <h2 className="text-sm font-semibold text-foreground">
                Order summary
              </h2>
              {loadingCatalog ? (
                <div className="mt-4 h-40 animate-pulse rounded-xl bg-muted" />
              ) : offer ? (
                <>
                  <div className="mt-4">
                    <span className="text-xs font-medium text-[#0089c8]">
                      {offer.categoryName}
                    </span>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {offer.packageName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {offer.planName} · {offer.termName} ·{" "}
                      {offer.durationValue} {offer.durationUnit}
                      {offer.durationValue === 1 ? "" : "s"}
                    </p>
                  </div>
                  <dl className="mt-5 space-y-2.5 border-t border-border pt-5 text-sm">
                    {[
                      ["Photos per ad", offer.photos],
                      ["Active ads", offer.ads],
                      ["Renewals", offer.renews],
                      ["Auto-renewals", offer.autoRenews],
                      ["Videos", offer.videos],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-medium tabular-nums text-foreground">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
                    {credit > 0 && (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Plan price</span>
                          <span className="tabular-nums">
                            ${money(planPrice)}
                          </span>
                        </div>
                        <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                          <span>Credit from current plan</span>
                          <span className="tabular-nums">
                            −${money(credit)}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium text-foreground">
                        Due today
                      </span>
                      <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                        ${money(dueToday)}
                        <small className="ml-1 text-xs font-medium text-muted-foreground">
                          {payment?.currency ?? "USD"}
                        </small>
                      </span>
                    </div>
                  </div>
                  {!payment && (
                    <Button
                      disabled={startingCheckout}
                      onClick={() => void startCheckout()}
                      className="mt-5 h-11 w-full rounded-xl bg-[#00a0e9] text-sm font-semibold text-white hover:bg-[#008ccb]"
                    >
                      {startingCheckout
                        ? "Preparing checkout…"
                        : "Continue to payment"}
                      {!startingCheckout && (
                        <ArrowRight className="ml-2 size-4" />
                      )}
                    </Button>
                  )}
                </>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Offer details unavailable.
                </p>
              )}
            </div>
            <div className="flex items-start gap-2 rounded-b-2xl border-t border-border bg-muted/60 px-6 py-4 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <span>
                Your plan activates only after Bakong confirms the payment.
              </span>
            </div>
            <div className="flex items-center gap-2 px-6 py-3 text-xs text-muted-foreground">
              <LockKeyhole className="size-3.5" /> Linked to your account
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
