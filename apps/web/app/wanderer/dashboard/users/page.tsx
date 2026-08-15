import UserClient from "./UserClient";
import { getAdminUsers } from "@/actions/admin-users";

export default async function UserPage() {
  const initialData = await getAdminUsers().catch(() => undefined);
  return <UserClient initialData={initialData} />;
}
