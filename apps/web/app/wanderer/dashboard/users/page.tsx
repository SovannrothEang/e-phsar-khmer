import UserClient from "./UserClient";
import { getAdminUsers } from "@/actions/admin-users";

export default async function UserPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const initialQ = typeof sp.q === "string" ? sp.q : "";
  const initialTab =
    sp.status === "suspended" || sp.status === "deleted" ? sp.status : "active";
  // The page renders the "Active" tab first, so the prefetched page must be
  // the same query the client asks for — including its status filter. A deep
  // link with a search or a non-Active tab fetches client-side.
  const initialData = await getAdminUsers({ status: "active" }).catch(
    () => undefined,
  );
  return (
    <UserClient
      // A fresh deep link (bell → filtered Users page) must reset the client's
      // local search/tab state even when this route is already mounted.
      key={`${initialTab}:${initialQ}`}
      initialData={initialData}
      initialQ={initialQ}
      initialTab={initialTab}
    />
  );
}
