import { NavBar } from "@/components/web/NavBar";
import Footer from "@/components/web/Footer";
import { getUserProfile } from "@/actions/user";
import { getModeratorSession } from "@/lib/auth/admin-session";
import { ModeratorProvider } from "@/components/moderation/moderator-provider";
import { ReactionsProvider } from "@/components/reactions/reactions-provider";
import { E2eBackupProvider } from "@/components/chat/e2e-backup-provider";
import { getMyReactionIds } from "@/lib/api/reactions";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The public site reads the USER session for chrome; the admin dashboard
  // session is checked separately so an admin browsing the marketplace gets
  // the staff moderation rows without a second account. A signed-in normal
  // user wins: the staff rows stay hidden even when an admin dashboard cookie
  // also lives in this browser (the two cookie pairs are independent).
  const [user, moderator] = await Promise.all([
    getUserProfile(),
    getModeratorSession(),
  ]);
  const staffViewer = moderator !== null && user?.role !== "user";
  // One batched read of the viewer's reaction ids — every heart and bookmark
  // on the page starts from this seed, so no card has to fetch its own state.
  // Anonymous visitors skip it entirely: there is nothing to seed.
  const reactions = user ? await getMyReactionIds() : { liked: [], saved: [] };

  return (
    <E2eBackupProvider userId={user?.id ?? null}>
      {/* Column shell so a short page keeps the footer on the bottom edge
          instead of letting it ride up under the navbar: the content cell
          grows to fill whatever the navbar and footer leave over. Pages that
          set their own `min-h-screen` still own their height as before. */}
      <div className="flex min-h-svh flex-col">
        <NavBar user={user} />
        <ModeratorProvider isModerator={staffViewer}>
          <ReactionsProvider
            // Remount when the viewer changes: the provider seeds its sets once,
            // and this layout survives client-side navigations — without the key,
            // an in-tab login or account switch would keep the previous viewer's
            // sets until a hard reload.
            key={user?.username ?? "anon"}
            signedIn={Boolean(user)}
            initialLiked={reactions.liked}
            initialSaved={reactions.saved}
          >
            <div className="flex-1">{children}</div>
          </ReactionsProvider>
        </ModeratorProvider>
        <Footer />
      </div>
    </E2eBackupProvider>
  );
}
