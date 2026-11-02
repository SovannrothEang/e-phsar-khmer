"use client";

import { Suspense, use, type ComponentProps } from "react";
import {
  FollowButton,
  FollowButtonPlaceholder,
} from "@/components/profile/FollowButton";
import { ApplyJobButton, ApplyJobButtonPlaceholder } from "./ApplyJobButton";
import type { JobApplyState } from "./Post-Detail";

/**
 * The two pieces of the listing page that arrive after its first paint — the
 * viewer's follow state and the Apply control's résumé lookup. The server page
 * hands them over as promises; each slot shows a disabled stand-in with the
 * real control's chrome and (hidden) label until its value lands, then swaps
 * the real control in. The stand-ins live next to the controls they mirror so
 * the two cannot drift. A plain value (signed-out viewer, not a job, own ad)
 * renders at once.
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

export function FollowSlot({ initialFollowing, ...rest }: FollowProps) {
  if (!isPromise(initialFollowing)) {
    return <FollowButton {...rest} initialFollowing={initialFollowing} />;
  }
  return (
    <Suspense fallback={<FollowButtonPlaceholder className={rest.className} />}>
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

export function JobApplySlot({ jobApply, ...props }: ApplyProps) {
  if (!jobApply) return null;
  if (!isPromise(jobApply)) return <ApplyFor {...props} state={jobApply} />;
  return (
    <Suspense fallback={<ApplyJobButtonPlaceholder />}>
      <ResolvedApply {...props} jobApply={jobApply} />
    </Suspense>
  );
}
