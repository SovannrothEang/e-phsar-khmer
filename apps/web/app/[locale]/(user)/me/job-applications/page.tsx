
import JobApplications from "@/components/profile/Job-Applications";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Job Applications - Psakhmer",
  description: "Job Applications",
};

export default function JobApplicationsPage() {
  return <JobApplications />;
}