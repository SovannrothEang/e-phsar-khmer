import ApplyJobs from "@/components/profile/Apply-Jobs";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Me.metadata");
  return { title: t("appliedJobs"), description: t("appliedJobs") };
}

export default function AppliedJobsPage() {
  return <ApplyJobs />;
}
