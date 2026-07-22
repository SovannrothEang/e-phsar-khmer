import { MyProfileHeader } from "@/components/profile/MyProfileHeader";
import { currentUser } from "@/lib/user";

export default function MyProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
    <MyProfileHeader user={currentUser} isOwnProfile />
     {children}
    </>
  );
}