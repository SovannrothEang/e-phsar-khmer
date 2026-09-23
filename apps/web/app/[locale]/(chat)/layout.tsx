import { NavBar } from "@/components/web/NavBar";
import { getUserProfile } from "@/actions/user";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserProfile();

  return (
    <>
      <NavBar user={user} />
      {children}
    </>
  );
}
