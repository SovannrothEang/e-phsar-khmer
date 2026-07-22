import { NavBar } from "@/components/web/NavBar";
import Footer from "@/components/web/Footer";
export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <NavBar />
      {children}
      <Footer />
    </>
  );
}