import { apiFetch } from "@/lib/api/client";

export type JobApplicationStatus = "pending" | "viewed" | "hired" | "rejected";

interface ApplicationUser {
  id: string;
  username: string | null;
  profilePhotoUrl: string | null;
}

export interface ApplicationListing {
  id: string;
  title: string;
  price: string | null;
  currency: string;
  status: string;
  thumbnailUrl: string | null;
  company: string | null;
}

/** A job I applied to (`GET /users/me/applications`). */
export interface AppliedJob {
  id: string;
  status: JobApplicationStatus;
  coverNote: string | null;
  createdAt: string;
  updatedAt: string;
  listing: ApplicationListing;
  poster: ApplicationUser;
}

/** An application to my listing (`GET /users/me/applications/received`). */
export interface ReceivedApplication {
  id: string;
  status: JobApplicationStatus;
  coverNote: string | null;
  createdAt: string;
  updatedAt: string;
  viewedAt: string | null;
  decidedAt: string | null;
  listing: ApplicationListing;
  applicant: ApplicationUser;
}

export async function fetchAppliedJobs(
  status?: JobApplicationStatus,
): Promise<AppliedJob[]> {
  const query = new URLSearchParams({ page: "1", pageSize: "50" });
  if (status) query.set("status", status);
  const { data } = await apiFetch<AppliedJob[]>(
    `/users/me/applications?${query.toString()}`,
  );
  return data ?? [];
}

export async function fetchReceivedApplications(
  status?: JobApplicationStatus,
): Promise<ReceivedApplication[]> {
  const query = new URLSearchParams({ page: "1", pageSize: "50" });
  if (status) query.set("status", status);
  const { data } = await apiFetch<ReceivedApplication[]>(
    `/users/me/applications/received?${query.toString()}`,
  );
  return data ?? [];
}
