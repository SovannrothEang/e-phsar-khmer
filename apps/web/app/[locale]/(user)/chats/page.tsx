import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Chats from "@/components/home/Chats";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Chat");
  return { title: t("inbox.title") };
}

export default function ChatsPage() {
  return (
    <div className="bg-muted py-0">
      <div className="mx-auto max-w-6xl md:px-4">
        <Chats />
      </div>
    </div>
  );
}
