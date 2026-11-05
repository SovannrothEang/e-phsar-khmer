"use client";

import { Suspense, use, type ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FollowButton,
  FollowButtonPlaceholder,
} from "@/components/profile/FollowButton";
import { ApplyJobButton, ApplyJobButtonPlaceholder } from "./ApplyJobButton";
import type { JobApplyState } from "./Post-Detail";
import { loadFollowStatus } from "@/actions/follows";

/**
 * The two pieces of the listing page that depend on the viewer — the follow
 * toggle's state and the Apply control's résumé lookup.
 *
 * The follow state is fetched by the browser after mount, so the server HTML
 * for the listing is the same for every viewer and no per-viewer query holds
 * up the response. Until it lands the slot shows the real control's chrome as
 * a disabled stand-in, then swaps the button in. The Apply lookup stays a
 * server promise: it needs the résumé, which the browser must not fetch.
 */

/**
 * `gcTime: 0` drops the answer when the slot unmounts, so moving between two
 * ads by the same seller re-asks instead of reusing a value a follow/unfollow
 * elsewhere has since changed. The mounted toggle owns the state optimistically,
 * so nothing in-flight is affected.
 */
const followStatusKey = (userId: string) =>
  ["user", "follow-status", userId] as const;

const isPromise = <T,>(value: T | Promise<T>): value is Promise<T> =>
  typeof (value as { then?: unknown } | null)?.then === "function";

type FollowProps = Omit<
  ComponentProps<typeof FollowButton>,
  "initialFollowing"
>;

export function FollowSlot({ userId, viewerId, ...rest }: FollowProps) {
  // Nothing to ask for a signed-out viewer or the seller's own ad; the button
  // itself renders the sign-in bounce or nothing at all.
  const needsLookup = !!viewerId && viewerId !== userId;
  const { data, isPending } = useQuery({
    queryKey: followStatusKey(userId),
    queryFn: () => loadFollowStatus(userId),
    enabled: needsLookup,
    staleTime: 0,
    gcTime: 0,
  });

  if (needsLookup && isPending) {
    return <FollowButtonPlaceholder className={rest.className} />;
  }

  return (
    <FollowButton
      {...rest}
      userId={userId}
      viewerId={viewerId}
      initialFollowing={data ?? false}
    />
  );
}

type ApplyProps = Omit<
  ComponentProps<typeof ApplyJobButton>,
  "resume" | "appliedApplicationId"
> & { jobApply: JobApplyState | null | Promise<JobApplyState | null> };

function ApplyFor({
  state,
  ...props
}: Omit<ApplyProps, "jobApply"> & { state: JobApplyState | null }) {
  if (!state) return null;
  return (
    <ApplyJobButton
      {...props}
      resume={state.resume}
      appliedApplicationId={state.appliedApplicationId}
    />
  );
}

function ResolvedApply({
  jobApply,
  ...props
}: Omit<ApplyProps, "jobApply"> & {
  jobApply: Promise<JobApplyState | null>;
}) {
  return <ApplyFor {...props} state={use(jobApply)} />;
}

export function JobApplySlot({ jobApply, ...props }: ApplyProps) {
  if (!jobApply) return null;
  if (!isPromise(jobApply)) return <ApplyFor {...props} state={jobApply} />;
  return (
    <Suspense fallback={<ApplyJobButtonPlaceholder />}>
      <ResolvedApply {...props} jobApply={jobApply} />
    </Suspense>
  );
}
