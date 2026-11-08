import UserClient from "./UserClient";
import { getAdminUsers } from "@/actions/admin-users";

export default async function UserPage() {
  // The page renders the "Active" tab first, so the prefetched page must be
  // the same query the client asks for — including its status filter.
  const initialData = await getAdminUsers({ status: "active" }).catch(
    () => undefined,
  );
  return <UserClient initialData={initialData} />;
}
