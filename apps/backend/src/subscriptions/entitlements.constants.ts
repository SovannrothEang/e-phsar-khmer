export interface PlanLimits {
  /** Photos per ad. */
  photos: number;
  /** Ads that may be live (active) at once. */
  ads: number;
  /** Times one ad may be re-published after its first publish. */
  renews: number;
  /** Auto-renewals — no auto-renew feature exists yet, so nothing spends this. */
  autoRenews: number;
  /** Videos per ad — listings carry no video yet, so nothing spends this. */
  videos: number;
}

/** What a user with no live subscription gets. The floor for every plan. */
export const FREE_PLAN_LIMITS: Readonly<PlanLimits> = {
  photos: 5,
  ads: 3,
  renews: 0,
  autoRenews: 0,
  videos: 0,
};
