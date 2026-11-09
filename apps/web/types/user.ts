export interface User {
  userId: string;
  username: string;
  name: string;
  password: string;
  profileImage: string;
  coverImage?: string;
  networks: string[];
  email: string;
  role: string;
  otp?: string;
  accountType: "Premium" | "Normal";
  isVerified: boolean;
  following: string[];
  followers: string[];
  /** Presence — unrelated to the account status below. */
  status: "Online" | "Offline";
  /** Exact last activity (ISO); staff-only tooltip, never a public surface. */
  lastSeenAt: string | null;
  /** Account state: what sign-in and public visibility read. */
  accountStatus: "active" | "suspended" | "deleted";
  /** The staff-written reason, shown to the account at sign-in. */
  statusReason?: string | null;
  createdAt: string;
  updatedAt: string;
}
