import Resume from "@/components/profile/Resume";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resume (CV) - Psakhmer",
  description: "Resume (CV)",
};

export default function ResumePage() {
  return <Resume />;
}
