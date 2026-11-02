"use client";

import { Suspense, use, type ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { FollowButton } from "@/components/profile/FollowButton";
import { ApplyJobButton } from "./ApplyJobButton";
import type { JobApplyState } from "./Post-Detail";

/**
 * The two pieces of the listing page that arrive after its first paint — the
 * viewer's follow state and the Apply control's résumé lookup. The server page
 * hands them over as promises; each slot shows a placeholder until its value
 * lands, then swaps the real control in. The placeholders match the controls'
 * heights; their widths are estimates that still need a browser check (en and
 * km labels differ in length), so a small horizontal change on swap is possible.
 * A plain value (signed-out viewer, not a job, own ad) renders at once.
 */

const isPromise = <T,>(value: T | Promise<T>): value is Promise<T> =>
  typeof (value as { then?: unknown } | null)?.then === "function";

type FollowProps = Omit<
  ComponentProps<typeof FollowButton>,
  "initialFollowing"
> & { initialFollowing: boolean | Promise<boolean> };

function ResolvedFollow({
  initialFollowing,
  ...rest
}: Omit<FollowProps, "initialFollowing"> & {
  initialFollowing: Promise<boolean>;
}) {
  // `FollowButton` keeps its optimistic state from the first value it sees, so
  // it is mounted only once the real answer is known.
  return <FollowButton {...rest} initialFollowing={use(initialFollowing)} />;
}

/** Height and top margin of the compact Follow button (`h-7`, `mt-9`); the width is an estimate. */
export function FollowButtonSkeleton() {
  return <Skeleton className="mt-9 h-7 w-[88px] rounded-sm" />;
}

export function FollowSlot({ initialFollowing, ...rest }: FollowProps) {
  if (!isPromise(initialFollowing)) {
    return <FollowButton {...rest} initialFollowing={initialFollowing} />;
  }
  return (
    <Suspense fallback={<FollowButtonSkeleton />}>
      <ResolvedFollow {...rest} initialFollowing={initialFollowing} />
    </Suspense>
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

/** Height of the Apply button (`h-10`); the width is an estimate of "Apply For This Job". */
export function ApplyButtonSkeleton() {
  return <Skeleton className="h-10 w-[132px] rounded-sm" />;
}

export function JobApplySlot({ jobApply, ...props }: ApplyProps) {
  if (!jobApply) return null;
  if (!isPromise(jobApply)) return <ApplyFor {...props} state={jobApply} />;
  return (
    <Suspense fallback={<ApplyButtonSkeleton />}>
      <ResolvedApply {...props} jobApply={jobApply} />
    </Suspense>
  );
}
