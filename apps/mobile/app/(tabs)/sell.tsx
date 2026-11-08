import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

/**
 * The Sell tab is a shortcut into the post flow, not a form. The tab button
 * opens the category chooser directly; this screen only catches deep links to
 * the old tab route.
 */
export default function SellTab() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/account/choose-category" as never);
  }, [router]);

  return <View className="flex-1 bg-neutral-background" />;
}
