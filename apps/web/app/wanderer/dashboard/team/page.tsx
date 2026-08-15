import TeamClient from "./TeamClient"
import { getAdminUsers } from "@/actions/admin-users"

export default async function Page() {
  const initialData = await getAdminUsers({ role: "admin" }).catch(
    () => undefined,
  )
  return <TeamClient initialData={initialData} />
}
