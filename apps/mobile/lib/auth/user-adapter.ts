import type { UserProfile } from "@/contexts/AuthContext";
import type { BackendUser } from "@/lib/api/auth";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function joinDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Keeps the mock-era `UserProfile` shape the existing screens render while the
 * real backend user is the source of truth. Fields the API does not carry yet
 * (stats, linked accounts, location name) start empty and are filled by the
 * step that owns them.
 */
export function toUserProfile(user: BackendUser): UserProfile {
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    user.primaryPhone ||
    "User";

  return {
    name,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    username: user.username ?? undefined,
    email: user.email ?? "",
    phone: user.primaryPhone ?? "",
    avatar: user.profilePhotoUrl ?? "",
    coverPhoto: user.coverPhotoUrl ?? "",
    gender: user.gender ?? undefined,
    telegram: "",
    accountType: user.isBusiness ? "Business account" : "Normal account",
    location: user.address ?? "",
    bio: "",
    joinDate: joinDate(user.createdAt),
    isVerified: Boolean(user.phoneVerifiedAt),
    connectedAccounts: {},
    stats: {
      activeAds: 0,
      favorites: 0,
      views: 0,
      rating: 0,
    },
  };
}
