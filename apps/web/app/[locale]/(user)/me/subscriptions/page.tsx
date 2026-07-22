import Subscription from "@/components/profile/Subscription";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subscriptions - Psakhmer",
  description: "Subscriptions",
};

export default function SubscriptionsPage() {
  return <Subscription />;
}