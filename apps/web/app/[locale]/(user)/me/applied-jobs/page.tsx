import ApplyJobs from "@/components/profile/Apply-Jobs"

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Applied Jobs - Psakhmer",
  description: "Applied Jobs",
};

export default function AppliedJobsPage() {
    return (
        <ApplyJobs />
    )
}