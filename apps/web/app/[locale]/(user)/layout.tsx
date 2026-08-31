import { NavBar } from "@/components/web/NavBar";
import Footer from "@/components/web/Footer";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <>
      <NavBar user={user} />
      {children}
      <Footer />
    </>
  );
}
