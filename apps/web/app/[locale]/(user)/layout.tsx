import { NavBar } from "@/components/web/NavBar";
import Footer from "@/components/web/Footer";
import { getUserProfile } from "@/actions/user";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserProfile();

  return (
    <>
      <NavBar user={user} />
      {children}
      <Footer />
    </>
  );
}
