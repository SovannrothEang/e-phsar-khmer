import AccountHeader from "@/components/account/AccountHeader";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { ApiError } from "@/lib/api/client";
import {
  createSubscriptionCheckout,
  fetchBillingAddresses,
  fetchPaymentProviders,
  fetchPaymentStatus,
  fetchSubscriptionCatalog,
  type PaymentProvider,
  type PaymentStatus,
  type SubscriptionCatalogItem,
} from "@/lib/api/subscriptions";
import { makeIdempotencyKey } from "@/lib/sell";
import { SITE_URL } from "@/lib/site";
import {
  discountBadge,
  finalPrice,
  money,
  validUntil,
} from "@/lib/subscription-pricing";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Bakong stores `{ qr, expiresAt }`; ABA carries `qrString`. */
function getQr(
  rawResponse: unknown,
): { qr: string; expiresAt: number | null } | null {
  if (!rawResponse || typeof rawResponse !== "object") return null;
  const raw = rawResponse as Record<string, unknown>;
  const qr = [raw.qr, raw.qrString, raw.qr_string].find(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (!qr) return null;
  return {
    qr,
    expiresAt: typeof raw.expiresAt === "number" ? raw.expiresAt : null,
  };
}

function providerIcon(
  name: string,
): React.ComponentProps<typeof Ionicons>["name"] {
  if (name === "bakong") return "qr-code-outline";
  if (name.includes("aba")) return "business-outline";
  return "card-outline";
}

function providerSubtitle(provider: PaymentProvider): string {
  if (provider.name === "bakong") return "Scan to pay with any banking app";
  if (provider.name.includes("aba")) return "Scan to pay with ABA Mobile";
  return `Pay with ${provider.displayName}`;
}

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ termId?: string | string[] }>();
  const termId = Array.isArray(params.termId)
    ? params.termId[0]
    : params.termId;

  const catalogQuery = useQuery({
    queryKey: ["subscription-catalog"],
    queryFn: fetchSubscriptionCatalog,
  });
  const addressesQuery = useQuery({
    queryKey: ["billing-addresses"],
    queryFn: fetchBillingAddresses,
  });
  const providersQuery = useQuery({
    queryKey: ["payment-providers"],
    queryFn: fetchPaymentProviders,
  });

  const term: SubscriptionCatalogItem | undefined = useMemo(
    () => (catalogQuery.data ?? []).find((item) => item.termId === termId),
    [catalogQuery.data, termId],
  );

  const providers = useMemo(
    () =>
      (providersQuery.data ?? []).filter(
        (provider) => provider.available && provider.name !== "aba_payway",
      ),
    [providersQuery.data],
  );
  const [providerName, setProviderName] = useState<string | null>(null);
  const selectedProvider =
    providers.find((provider) => provider.name === providerName) ??
    providers[0];

  const address =
    (addressesQuery.data ?? []).find((item) => item.isDefault) ??
    addressesQuery.data?.[0];

  const [starting, setStarting] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [checkoutAmount, setCheckoutAmount] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const idempotencyKey = useRef(makeIdempotencyKey());

  const paymentQuery = useQuery({
    queryKey: ["payment", paymentId],
    queryFn: () => fetchPaymentStatus(paymentId as string),
    enabled: Boolean(paymentId),
    refetchInterval: (query) => {
      const status = (query.state.data as PaymentStatus | undefined)?.status;
      return status === "succeeded" ||
        status === "failed" ||
        status === "cancelled" ||
        status === "expired"
        ? false
        : 3000;
    },
  });
  const payment = paymentQuery.data;
  const qrInfo = getQr(payment?.checkout?.rawResponse);

  // Ticking clock for the QR countdown.
  useEffect(() => {
    if (!paymentId) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [paymentId]);

  useEffect(() => {
    if (!payment || payment.status !== "succeeded") return;
    Alert.alert("Payment received", "Your subscription is now active.", [
      {
        text: "OK",
        onPress: () => router.replace("/account/membership" as never),
      },
    ]);
  }, [payment]);

  const startCheckout = async () => {
    if (!term || !selectedProvider || starting) return;
    setStarting(true);
    try {
      const checkout = await createSubscriptionCheckout({
        termId: term.termId,
        idempotencyKey: idempotencyKey.current,
        provider: selectedProvider.name,
      });
      setCheckoutAmount(checkout.amount);
      setPaymentId(checkout.paymentTransactionId);
    } catch (error) {
      Alert.alert(
        "Could not start the checkout",
        error instanceof ApiError ? error.message : "Please try again.",
      );
    } finally {
      setStarting(false);
    }
  };

  const retry = () => {
    idempotencyKey.current = makeIdempotencyKey();
    setPaymentId(null);
    setCheckoutAmount(null);
  };

  if (catalogQuery.isLoading) {
    return (
      <SafeAreaView
        statusBarColor={Colors.primary.DEFAULT}
        statusBarStyle="light-content"
        className="flex-1 bg-neutral-background"
      >
        <AccountHeader
          title="Review Subscription"
          variant="blue"
          showHeadset={false}
        />
        <View className="items-center py-16">
          <ActivityIndicator color={Colors.primary.DEFAULT} />
        </View>
      </SafeAreaView>
    );
  }

  if (!term) {
    return (
      <SafeAreaView
        statusBarColor={Colors.primary.DEFAULT}
        statusBarStyle="light-content"
        className="flex-1 bg-neutral-background"
      >
        <AccountHeader
          title="Review Subscription"
          variant="blue"
          showHeadset={false}
        />
        <View className="items-center px-6 py-16">
          <Text className="text-center text-sm text-gray-500">
            This plan is no longer available.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-4 rounded-lg bg-primary px-6 py-2.5"
          >
            <Text className="font-bold text-white">Choose another plan</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Waiting on the payer: show the KHQR until it settles or expires.
  if (paymentId) {
    const waiting =
      !payment ||
      payment.status === "pending" ||
      payment.status === "processing";
    const remaining =
      qrInfo?.expiresAt && waiting ? Math.max(0, qrInfo.expiresAt - now) : null;
    const clock =
      remaining !== null
        ? `${Math.floor(remaining / 60000)}:${String(
            Math.floor((remaining % 60000) / 1000),
          ).padStart(2, "0")}`
        : null;

    return (
      <SafeAreaView
        statusBarColor={Colors.primary.DEFAULT}
        statusBarStyle="light-content"
        className="flex-1 bg-neutral-background"
      >
        <AccountHeader
          title="Review Subscription"
          variant="blue"
          showHeadset={false}
        />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        >
          <View className="items-center rounded-lg border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            {waiting ? (
              qrInfo ? (
                <>
                  <Text className="text-base font-semibold text-gray-900 dark:text-white">
                    Scan to pay {checkoutAmount ? `$${checkoutAmount}` : ""}
                  </Text>
                  <View className="mt-4 rounded-lg bg-white p-3">
                    <QRCode value={qrInfo.qr} size={220} />
                  </View>
                  <Text className="mt-4 text-sm text-gray-500">
                    Open your banking app and scan this KHQR code.
                  </Text>
                  {clock ? (
                    <Text className="mt-1 text-sm font-medium text-gray-400">
                      Expires in {clock}
                    </Text>
                  ) : null}
                  <ActivityIndicator
                    color={Colors.primary.DEFAULT}
                    style={{ marginTop: 16 }}
                  />
                </>
              ) : (
                <>
                  <ActivityIndicator
                    color={Colors.primary.DEFAULT}
                    size="large"
                  />
                  <Text className="mt-4 text-base font-semibold text-gray-900 dark:text-white">
                    Preparing your QR code…
                  </Text>
                  <Text className="mt-1 text-sm text-gray-500">
                    This takes a few seconds.
                  </Text>
                </>
              )
            ) : payment?.status === "succeeded" ? (
              <>
                <Ionicons name="checkmark-circle" size={56} color="#10B981" />
                <Text className="mt-3 text-lg font-bold text-gray-900 dark:text-white">
                  Payment received
                </Text>
                <Text className="mt-1 text-sm text-gray-500">
                  Your subscription is now active.
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="close-circle" size={56} color="#EF4444" />
                <Text className="mt-3 text-lg font-bold text-gray-900 dark:text-white">
                  Payment not completed
                </Text>
                <Text className="mt-1 text-center text-sm text-gray-500">
                  {payment?.status === "expired"
                    ? "This QR code has expired."
                    : "The payment was cancelled or failed."}
                </Text>
                <TouchableOpacity
                  onPress={retry}
                  className="mt-5 rounded-lg bg-primary px-6 py-3"
                >
                  <Text className="font-bold text-white">Try again</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const subtotal = Number(term.price);
  const total = finalPrice(term);
  const discount = Math.max(0, subtotal - total);

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="flex-1 bg-neutral-background"
    >
      <AccountHeader
        title="Review Subscription"
        variant="blue"
        showHeadset={false}
      />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        {/* Subscription */}
        <View className="mt-3 bg-white px-4 py-4 dark:bg-gray-900">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            Subscription
          </Text>
          <View className="mt-3 flex-row items-center">
            <View className="mr-3 h-14 w-14 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
              <Ionicons name="image-outline" size={26} color="#9CA3AF" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {term.groupName}: {term.packageName} - {term.termName}
              </Text>
              <Text className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Valid Until {validUntil(term.durationValue, term.durationUnit)}
              </Text>
              <Text className="mt-1 text-base font-bold text-primary">
                {money(total)}
              </Text>
            </View>
          </View>
        </View>

        {/* Billing Address */}
        <View className="mt-2 bg-white px-4 py-4 dark:bg-gray-900">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            Billing Address <Text className="text-red-500">*</Text>
          </Text>
          {address ? (
            <View className="mt-3 rounded-lg border border-gray-100 p-3 dark:border-gray-800">
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {address.name}
              </Text>
              <Text className="mt-0.5 text-sm text-gray-500">
                {address.phone}
              </Text>
              <Text className="mt-1 text-sm text-gray-500">
                {address.address}
              </Text>
            </View>
          ) : (
            <>
              <Text className="mt-1 text-base text-gray-600 dark:text-gray-400">
                Seems like you haven&apos;t saved any addresses yet!
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  void Linking.openURL(
                    `${SITE_URL}/en/settings/billing-addresses`,
                  )
                }
                className="mt-3 h-11 flex-row items-center justify-center rounded-md bg-[#DCEEF8]"
              >
                <Ionicons name="add" size={20} color="#0EA5E9" />
                <Text className="ml-1 text-base font-semibold text-primary">
                  Add Address
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Payment methods */}
        <View className="mt-2 bg-white px-4 py-4 dark:bg-gray-900">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            Payment methods
          </Text>
          {providers.length === 0 ? (
            <Text className="mt-2 text-sm text-gray-500">
              No payment method is available right now.
            </Text>
          ) : (
            providers.map((provider) => {
              const selected = selectedProvider?.name === provider.name;
              return (
                <TouchableOpacity
                  key={provider.name}
                  activeOpacity={0.7}
                  onPress={() => setProviderName(provider.name)}
                  className="mt-2 flex-row items-center border-t border-gray-100 py-3 dark:border-gray-800"
                >
                  <View className="mr-3 h-11 w-14 items-center justify-center rounded-md bg-gray-900">
                    <Ionicons
                      name={providerIcon(provider.name)}
                      size={24}
                      color="white"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900 dark:text-white">
                      {provider.displayName}
                    </Text>
                    <Text className="mt-0.5 text-sm text-gray-500">
                      {providerSubtitle(provider)}
                    </Text>
                  </View>
                  {selected ? (
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-primary">
                      <Ionicons name="checkmark" size={15} color="white" />
                    </View>
                  ) : (
                    <View className="h-6 w-6 rounded-full border border-gray-300" />
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Summary */}
        <View className="mt-2 bg-white px-4 py-4 dark:bg-gray-900">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            Summary
          </Text>
          <View className="mt-3 flex-row justify-between">
            <Text className="text-base text-gray-600 dark:text-gray-400">
              Subtotal
            </Text>
            <Text className="text-base text-gray-900 dark:text-white">
              {money(subtotal)}
            </Text>
          </View>
          <View className="mt-2 flex-row justify-between">
            <Text className="text-base text-gray-600 dark:text-gray-400">
              Discount
            </Text>
            <Text className="text-base text-gray-900 dark:text-white">
              {discount > 0 ? `-${money(discount)}` : "$0"}
            </Text>
          </View>
          <View className="mt-2 flex-row justify-between">
            <Text className="text-base text-gray-600 dark:text-gray-400">
              VAT
            </Text>
            <Text className="text-base text-gray-900 dark:text-white">$0</Text>
          </View>
        </View>
      </ScrollView>

      <View
        className="border-t border-gray-200 bg-white px-4 pt-3 dark:border-gray-800 dark:bg-gray-950"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-gray-900 dark:text-white">
            Total{" "}
            <Text className="text-sm font-normal text-gray-500">
              (incl. VAT)
            </Text>
          </Text>
          <Text className="text-lg font-bold text-gray-900 dark:text-white">
            {money(total)}
            {discountBadge(term) ? (
              <Text className="ml-2 text-sm font-normal text-gray-400">
                {discountBadge(term)}
              </Text>
            ) : null}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.9}
          disabled={starting || !selectedProvider}
          onPress={() => void startCheckout()}
          className={`h-12 items-center justify-center rounded-md ${
            starting || !selectedProvider
              ? "bg-gray-300"
              : "bg-secondary-orange"
          }`}
        >
          {starting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-bold text-white">
              Review address & Check out
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
