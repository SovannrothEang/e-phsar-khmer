import { notFound } from "next/navigation";
import { AttributeManager } from "@/components/dashboard/attribute-manager";
import { ATTRIBUTE_TYPES } from "@/lib/attribute-types";

export default async function Page({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const meta = ATTRIBUTE_TYPES.find((t) => t.type === type);
  if (!meta) notFound();
  return (
    <AttributeManager
      type={meta.type}
      title={meta.title}
      hasImage={meta.hasImage}
      readOnly={meta.readOnly}
    />
  );
}
