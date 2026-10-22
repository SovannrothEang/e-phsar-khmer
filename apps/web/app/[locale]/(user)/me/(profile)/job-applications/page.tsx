import JobApplications from "@/components/profile/Job-Applications";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Me.metadata");
  return { title: t("jobApplications"), description: t("jobApplications") };
}

export default function JobApplicationsPage() {
  return <JobApplications />;
}
