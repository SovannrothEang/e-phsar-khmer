import Feedback from "@/components/page/Feedback";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback - Psakhmer",
  description: "Feedback",
};
export default function FeedbackPage() {
  return <Feedback />;
}
