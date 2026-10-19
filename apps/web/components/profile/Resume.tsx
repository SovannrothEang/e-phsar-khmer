import { getResume } from "@/actions/resume";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { ResumeStartBuilding } from "@/components/profile/ResumeStartBuilding";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getAttributeOptions,
  getCategoryWithSubcategories,
  getProvinces,
} from "@/lib/api/categories";

/**
 * The CV page behind "Resume (CV)" (/me/resume).
 *
 * Deliberately OUTSIDE the `me/(profile)` route group's layout: this page
 * renders its own breadcrumb instead of the account/profile header, so the CV
 * surface is its own section rather than something under the account profile.
 *
 * Everything below the breadcrumb is ResumeStartBuilding; the Job Preferences
 * form's picker options are loaded here and passed down — "Categories" is the
 * Jobs category's subcategory list (Accounting, Administration, …), not the
 * marketplace's main categories.
 */

/**
 * The `jobtypes` attribute set mixes two things: the employment types (spec
 * six:4 — Full-time, Part-time, Internship, …) and the 36 jobs-subcategory
 * names used by the browse grids. The Job Preferences form wants the former —
 * its Categories picker already lists the jobs subcategories.
 */
const EMPLOYMENT_TYPE_SLUGS = new Set([
  "full-time",
  "part-time",
  "internships",
  "freelance",
  "contract",
  "volunteer",
  "other-jobs",
]);

export default async function Resume() {
  const me = await getCurrentUser();
  const locale = await getLocale();
  if (!me) return redirect({ href: "/login", locale });

  const [jobsCategory, jobTypes, provinces, resume] = await Promise.all([
    getCategoryWithSubcategories("jobs", locale),
    getAttributeOptions("jobtypes"),
    getProvinces(),
    getResume(),
  ]);
  const employmentTypes = jobTypes.filter((a) =>
    EMPLOYMENT_TYPE_SLUGS.has(a.slug),
  );

  return (
    <div className="min-h-screen bg-muted/50 pb-20">
      {/* Breadcrumb on the page background — same trail as the category pages. */}
      <div className="max-w-7xl mx-auto w-full px-4 pt-4">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Profile", href: "/me" },
            { label: "Resume (CV)" },
          ]}
        />
      </div>

      {resume.ok ? (
        <ResumeStartBuilding
          initial={resume.document}
          firstName={me.firstName}
          lastName={me.lastName}
          preferenceOptions={{
            categories: (jobsCategory?.subcategories ?? []).map((s) => s.name),
            jobTypes: employmentTypes.map((a) => a.name),
            locations: provinces.map((p) => p.name),
          }}
        />
      ) : (
        // A failed load must never look like "no resume yet": starting the
        // wizard from that state would write over a resume that exists.
        <div className="max-w-7xl mx-auto w-full px-4 pt-4">
          <div className="rounded-2xl border bg-card p-6 text-center sm:p-10">
            <p className="text-base text-foreground">
              Couldn&apos;t load your resume. Refresh the page to try again.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
