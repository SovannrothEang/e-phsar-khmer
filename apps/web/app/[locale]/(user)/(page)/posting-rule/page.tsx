
import PostingRule from "@/components/page/Posting-Rule";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Posting Rule - Psakhmer",
  description: "Posting Rule",
};
export default function PostingRulePage() {
  return <PostingRule />;
}