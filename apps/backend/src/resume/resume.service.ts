import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import {
  resumeAttachments,
  resumeEducations,
  resumeExperiences,
  resumeJobPreferences,
  resumeLanguages,
  resumePersonal,
  resumeReferences,
  resumeSkills,
  resumes,
} from '../db/schema/resume.schema';
import type {
  ResumeEducationRow,
  ResumeExperienceRow,
  ResumeJobPreferenceRow,
  ResumeLanguageRow,
  ResumePersonalRow,
  ResumeReferenceRow,
  ResumeSkillRow,
} from '../db/schema/resume.schema';
import { communes, districts, provinces } from '../db/schema/users.schema';
import { FilesService } from '../files/files.service';
import type { UpdatePersonalDto } from './dto/update-personal.dto';
import type {
  JobPreferencesDto,
  UpdateResumeDto,
} from './dto/update-resume.dto';
import type { UpsertEducationDto } from './dto/upsert-education.dto';
import type { UpsertExperienceDto } from './dto/upsert-experience.dto';
import type { UpsertLanguageDto } from './dto/upsert-language.dto';
import type { UpsertReferenceDto } from './dto/upsert-reference.dto';
import type { UpsertSkillDto } from './dto/upsert-skill.dto';

/** A geography row as the resume surfaces it — the same shape locations serve. */
export interface Place {
  id: string;
  name: string;
  slug: string;
}

/** Request side takes flat ids, the response side returns resolved rows. */
export interface ResumeLocationWire {
  province: Place | null;
  district: Place | null;
  commune: Place | null;
}

export interface ResumePersonalWire {
  firstName: string;
  lastName: string;
  gender: string | null;
  dob: string | null;
  nationality: string | null;
  email: string | null;
  educationLevel: string | null;
  maritalStatus: string | null;
  place: ResumeLocationWire;
  address: string | null;
  position: string | null;
  yearsOfExperience: number | null;
  phones: string[];
  photoUrl: string | null;
}

export interface ResumeExperienceWire {
  id: string;
  company: string;
  position: string;
  place: ResumeLocationWire;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string;
}

export interface ResumeEducationWire {
  id: string;
  school: string;
  degree: string;
  major: string;
  place: ResumeLocationWire;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string;
}

export interface ResumeSkillWire {
  id: string;
  title: string;
  level: string;
}

export interface ResumeLanguageWire {
  id: string;
  title: string;
  level: string;
}

export interface ResumeReferenceWire {
  id: string;
  name: string;
  company: string;
  position: string;
  phones: string[];
  email: string | null;
}

export interface ResumeJobPreferenceWire {
  openJob: boolean;
  position: string | null;
  category: string[];
  location: string[];
  jobType: string[];
}

export interface ResumeAttachmentWire {
  id: string;
  fileName: string;
  size: number;
  uploadedAt: string;
}

export interface ResumeDocumentWire {
  exists: boolean;
  personal: ResumePersonalWire | null;
  summary: string;
  hobbies: string;
  experiences: ResumeExperienceWire[];
  educations: ResumeEducationWire[];
  skills: ResumeSkillWire[];
  languages: ResumeLanguageWire[];
  references: ResumeReferenceWire[];
  jobPreference: ResumeJobPreferenceWire | null;
  attachment: ResumeAttachmentWire | null;
}

/** The geography ids every located row carries (personal, experiences, educations). */
interface LocatedRow {
  provinceId: string | null;
  districtId: string | null;
  communeId: string | null;
}

/**
 * The CV document: one `resumes` row per user plus its section tables, read
 * whole for `/me/resume` and written one section at a time by the dialogs.
 *
 * Two rules run through every write here. **Ownership is the WHERE clause** —
 * a child upsert only touches a row whose `resume_id` is the caller's
 * (`setWhere`), so a foreign or missing id changes nothing and the caller gets
 * a 404, never a 403 and never a hint that the id exists. **A delete never
 * 404s**: the toggle's end state is the contract (`{ id, deleted: true }`),
 * the same rule `unlikeListing` and `unfollowUser` follow.
 *
 * Cross-field rules the DTO cannot express (date order, an ongoing entry, a
 * district without its province) live here; pure shape and length live in the
 * DTOs.
 */
@Injectable()
export class ResumeService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly filesService: FilesService,
  ) {}

  /** The whole document, assembled for the caller. Never another user's. */
  async getDocument(userId: string): Promise<ResumeDocumentWire> {
    const [document] = await this.db
      .select({
        id: resumes.id,
        summary: resumes.summary,
        hobbies: resumes.hobbies,
      })
      .from(resumes)
      .where(eq(resumes.userId, userId))
      .limit(1);
    if (!document) return emptyDocument();

    const resumeId = document.id;
    const [
      personalRows,
      experiences,
      educations,
      skills,
      languages,
      references,
      preferences,
      attachments,
    ] = await Promise.all([
      this.db
        .select()
        .from(resumePersonal)
        .where(eq(resumePersonal.resumeId, resumeId))
        .limit(1),
      this.db
        .select()
        .from(resumeExperiences)
        .where(eq(resumeExperiences.resumeId, resumeId))
        .orderBy(asc(resumeExperiences.createdAt), asc(resumeExperiences.id)),
      this.db
        .select()
        .from(resumeEducations)
        .where(eq(resumeEducations.resumeId, resumeId))
        .orderBy(asc(resumeEducations.createdAt), asc(resumeEducations.id)),
      this.db
        .select()
        .from(resumeSkills)
        .where(eq(resumeSkills.resumeId, resumeId))
        .orderBy(asc(resumeSkills.createdAt), asc(resumeSkills.id)),
      this.db
        .select()
        .from(resumeLanguages)
        .where(eq(resumeLanguages.resumeId, resumeId))
        .orderBy(asc(resumeLanguages.createdAt), asc(resumeLanguages.id)),
      this.db
        .select()
        .from(resumeReferences)
        .where(eq(resumeReferences.resumeId, resumeId))
        .orderBy(asc(resumeReferences.createdAt), asc(resumeReferences.id)),
      this.db
        .select()
        .from(resumeJobPreferences)
        .where(eq(resumeJobPreferences.resumeId, resumeId))
        .limit(1),
      this.db
        .select()
        .from(resumeAttachments)
        .where(
          and(
            eq(resumeAttachments.resumeId, resumeId),
            eq(resumeAttachments.status, 'attached'),
          ),
        )
        .orderBy(desc(resumeAttachments.attachedAt), desc(resumeAttachments.id))
        .limit(1),
    ]);

    // One lookup per geography level for the whole document: the ids are
    // collected across all three located sections before the reads, so a
    // province on the personal block and on two experiences costs one query.
    const places = await this.loadPlaceMaps([
      ...personalRows,
      ...experiences,
      ...educations,
    ]);
    const personal = attachPlaces(personalRows, places);
    const locatedExperiences = attachPlaces(experiences, places);
    const locatedEducations = attachPlaces(educations, places);
    const [jobPreference] = preferences;
    const [attachment] = attachments;

    return {
      exists: true,
      personal: personal[0] ? toPersonalWire(personal[0]) : null,
      summary: document.summary,
      hobbies: document.hobbies,
      experiences: locatedExperiences.map(toExperienceWire),
      educations: locatedEducations.map(toEducationWire),
      skills: skills.map(toSkillWire),
      languages: languages.map(toLanguageWire),
      references: references.map(toReferenceWire),
      jobPreference: jobPreference ? toJobPreferenceWire(jobPreference) : null,
      attachment: attachment ? toAttachmentWire(attachment) : null,
    };
  }

  /** Step 1. Upserted on the resume's own id — the row is 1:1 by design. */
  async savePersonal(
    userId: string,
    dto: UpdatePersonalDto,
  ): Promise<ResumePersonalWire> {
    assertChildRelations(dto);
    const resumeId = await this.getOrCreateResumeId(userId);

    // Read the previous photo before the write: the replaced object is removed
    // *after* the commit, gated on the value actually changing (the
    // established replace-and-clean pattern).
    const [existing] = await this.db
      .select({ photoUrl: resumePersonal.photoUrl })
      .from(resumePersonal)
      .where(eq(resumePersonal.resumeId, resumeId))
      .limit(1);

    const values = {
      resumeId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      gender: dto.gender ?? null,
      dob: dto.dob ?? null,
      nationality: dto.nationality ?? null,
      email: dto.email ?? null,
      educationLevel: dto.educationLevel ?? null,
      maritalStatus: dto.maritalStatus ?? null,
      provinceId: dto.provinceId ?? null,
      districtId: dto.districtId ?? null,
      communeId: dto.communeId ?? null,
      address: dto.address ?? null,
      position: dto.position ?? null,
      yearsOfExperience: dto.yearsOfExperience ?? null,
      phones: dto.phones,
      photoUrl: dto.photoUrl ?? null,
    };
    const [row] = await this.db
      .insert(resumePersonal)
      .values(values)
      .onConflictDoUpdate({ target: resumePersonal.resumeId, set: values })
      .returning();

    const previousPhoto = existing?.photoUrl ?? null;
    if (previousPhoto && previousPhoto !== values.photoUrl)
      await this.filesService.removeByPublicUrl(previousPhoto);

    const places = await this.loadPlaceMaps([row]);
    return toPersonalWire(attachPlaces([row], places)[0]);
  }

  /**
   * The two free-text blocks and the Job Preferences row. `undefined` leaves a
   * value alone, an explicit `null` clears it (the string blocks become `''`,
   * the preference row is deleted) — `PATCH /users/me`'s contract verbatim.
   */
  async updateDocument(
    userId: string,
    dto: UpdateResumeDto,
  ): Promise<{
    summary: string;
    hobbies: string;
    jobPreference: ResumeJobPreferenceWire | null;
  }> {
    const [existing] = await this.db
      .select({ id: resumes.id })
      .from(resumes)
      .where(eq(resumes.userId, userId))
      .limit(1);
    let resumeId: string | null = existing?.id ?? null;

    if (dto.summary !== undefined || dto.hobbies !== undefined) {
      resumeId = resumeId ?? (await this.getOrCreateResumeId(userId));
      const set: { summary?: string; hobbies?: string } = {};
      if (dto.summary !== undefined) set.summary = dto.summary ?? '';
      if (dto.hobbies !== undefined) set.hobbies = dto.hobbies ?? '';
      await this.db.update(resumes).set(set).where(eq(resumes.id, resumeId));
    }

    if (dto.jobPreferences === null) {
      if (resumeId)
        await this.db
          .delete(resumeJobPreferences)
          .where(eq(resumeJobPreferences.resumeId, resumeId));
    } else if (dto.jobPreferences) {
      resumeId = resumeId ?? (await this.getOrCreateResumeId(userId));
      await this.upsertJobPreference(resumeId, dto.jobPreferences);
    }

    if (!resumeId) return { summary: '', hobbies: '', jobPreference: null };
    const [[row], [preference]] = await Promise.all([
      this.db
        .select({ summary: resumes.summary, hobbies: resumes.hobbies })
        .from(resumes)
        .where(eq(resumes.id, resumeId))
        .limit(1),
      this.db
        .select()
        .from(resumeJobPreferences)
        .where(eq(resumeJobPreferences.resumeId, resumeId))
        .limit(1),
    ]);

    return {
      summary: row?.summary ?? '',
      hobbies: row?.hobbies ?? '',
      jobPreference: preference ? toJobPreferenceWire(preference) : null,
    };
  }

  async upsertExperience(
    userId: string,
    id: string,
    dto: UpsertExperienceDto,
  ): Promise<ResumeExperienceWire> {
    assertChildRelations(dto);
    const endDate = assertDates(
      dto.startDate,
      dto.endDate ?? null,
      dto.current,
    );
    const resumeId = await this.getOrCreateResumeId(userId);
    const values = {
      company: dto.company,
      position: dto.position,
      provinceId: dto.provinceId ?? null,
      districtId: dto.districtId ?? null,
      communeId: dto.communeId ?? null,
      startDate: dto.startDate,
      endDate,
      isCurrent: dto.current,
      description: dto.description ?? '',
    };
    const [row] = await this.db
      .insert(resumeExperiences)
      .values({ id, resumeId, ...values })
      .onConflictDoUpdate({
        target: resumeExperiences.id,
        set: values,
        setWhere: eq(resumeExperiences.resumeId, resumeId),
      })
      .returning();
    if (!row) throw new NotFoundException('Resume entry not found');

    const places = await this.loadPlaceMaps([row]);
    return toExperienceWire(attachPlaces([row], places)[0]);
  }

  async deleteExperience(
    userId: string,
    id: string,
  ): Promise<{ id: string; deleted: true }> {
    const resumeId = await this.findResumeId(userId);
    if (resumeId)
      await this.db
        .delete(resumeExperiences)
        .where(
          and(
            eq(resumeExperiences.id, id),
            eq(resumeExperiences.resumeId, resumeId),
          ),
        );
    return { id, deleted: true };
  }

  async upsertEducation(
    userId: string,
    id: string,
    dto: UpsertEducationDto,
  ): Promise<ResumeEducationWire> {
    assertChildRelations(dto);
    const endDate = assertDates(
      dto.startDate,
      dto.endDate ?? null,
      dto.current,
    );
    const resumeId = await this.getOrCreateResumeId(userId);
    const values = {
      school: dto.school,
      degree: dto.degree,
      major: dto.major,
      provinceId: dto.provinceId ?? null,
      districtId: dto.districtId ?? null,
      communeId: dto.communeId ?? null,
      startDate: dto.startDate,
      endDate,
      isCurrent: dto.current,
      description: dto.description ?? '',
    };
    const [row] = await this.db
      .insert(resumeEducations)
      .values({ id, resumeId, ...values })
      .onConflictDoUpdate({
        target: resumeEducations.id,
        set: values,
        setWhere: eq(resumeEducations.resumeId, resumeId),
      })
      .returning();
    if (!row) throw new NotFoundException('Resume entry not found');

    const places = await this.loadPlaceMaps([row]);
    return toEducationWire(attachPlaces([row], places)[0]);
  }

  async deleteEducation(
    userId: string,
    id: string,
  ): Promise<{ id: string; deleted: true }> {
    const resumeId = await this.findResumeId(userId);
    if (resumeId)
      await this.db
        .delete(resumeEducations)
        .where(
          and(
            eq(resumeEducations.id, id),
            eq(resumeEducations.resumeId, resumeId),
          ),
        );
    return { id, deleted: true };
  }

  async upsertSkill(
    userId: string,
    id: string,
    dto: UpsertSkillDto,
  ): Promise<ResumeSkillWire> {
    const resumeId = await this.getOrCreateResumeId(userId);
    const values = { title: dto.title, level: dto.level };
    const [row] = await this.db
      .insert(resumeSkills)
      .values({ id, resumeId, ...values })
      .onConflictDoUpdate({
        target: resumeSkills.id,
        set: values,
        setWhere: eq(resumeSkills.resumeId, resumeId),
      })
      .returning();
    if (!row) throw new NotFoundException('Resume entry not found');
    return toSkillWire(row);
  }

  async deleteSkill(
    userId: string,
    id: string,
  ): Promise<{ id: string; deleted: true }> {
    const resumeId = await this.findResumeId(userId);
    if (resumeId)
      await this.db
        .delete(resumeSkills)
        .where(
          and(eq(resumeSkills.id, id), eq(resumeSkills.resumeId, resumeId)),
        );
    return { id, deleted: true };
  }

  async upsertLanguage(
    userId: string,
    id: string,
    dto: UpsertLanguageDto,
  ): Promise<ResumeLanguageWire> {
    const resumeId = await this.getOrCreateResumeId(userId);
    const values = { title: dto.title, level: dto.level };
    const [row] = await this.db
      .insert(resumeLanguages)
      .values({ id, resumeId, ...values })
      .onConflictDoUpdate({
        target: resumeLanguages.id,
        set: values,
        setWhere: eq(resumeLanguages.resumeId, resumeId),
      })
      .returning();
    if (!row) throw new NotFoundException('Resume entry not found');
    return toLanguageWire(row);
  }

  async deleteLanguage(
    userId: string,
    id: string,
  ): Promise<{ id: string; deleted: true }> {
    const resumeId = await this.findResumeId(userId);
    if (resumeId)
      await this.db
        .delete(resumeLanguages)
        .where(
          and(
            eq(resumeLanguages.id, id),
            eq(resumeLanguages.resumeId, resumeId),
          ),
        );
    return { id, deleted: true };
  }

  async upsertReference(
    userId: string,
    id: string,
    dto: UpsertReferenceDto,
  ): Promise<ResumeReferenceWire> {
    const resumeId = await this.getOrCreateResumeId(userId);
    const values = {
      name: dto.name,
      company: dto.company,
      position: dto.position,
      phones: dto.phones,
      email: dto.email ?? null,
    };
    const [row] = await this.db
      .insert(resumeReferences)
      .values({ id, resumeId, ...values })
      .onConflictDoUpdate({
        target: resumeReferences.id,
        set: values,
        setWhere: eq(resumeReferences.resumeId, resumeId),
      })
      .returning();
    if (!row) throw new NotFoundException('Resume entry not found');
    return toReferenceWire(row);
  }

  async deleteReference(
    userId: string,
    id: string,
  ): Promise<{ id: string; deleted: true }> {
    const resumeId = await this.findResumeId(userId);
    if (resumeId)
      await this.db
        .delete(resumeReferences)
        .where(
          and(
            eq(resumeReferences.id, id),
            eq(resumeReferences.resumeId, resumeId),
          ),
        );
    return { id, deleted: true };
  }

  /**
   * The write-side anchor, and an upsert on purpose: two dialogs submitting
   * before any row exists must not race into a unique violation, and
   * `onConflictDoNothing` would return no row at all. `set: { userId }` is the
   * no-op that makes `do update` legal — it exists only so the conflicting
   * insert returns the existing id.
   *
   * `updated_at` is pinned to itself because drizzle's `$onUpdate` forces
   * every such column into the SET clause of any `do update`: without the pin,
   * this no-op would stamp a fresh timestamp on every child write, and the
   * column would stop meaning "the document itself was edited".
   */
  async getOrCreateResumeId(userId: string): Promise<string> {
    const [row] = await this.db
      .insert(resumes)
      .values({ userId })
      .onConflictDoUpdate({
        target: resumes.userId,
        set: { userId, updatedAt: resumes.updatedAt },
      })
      .returning({ id: resumes.id });
    return row.id;
  }

  /** The read-side anchor: no row means no resume yet, and no writes. */
  private async findResumeId(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: resumes.id })
      .from(resumes)
      .where(eq(resumes.userId, userId))
      .limit(1);
    return row?.id ?? null;
  }

  private async upsertJobPreference(
    resumeId: string,
    dto: JobPreferencesDto,
  ): Promise<void> {
    const values = {
      resumeId,
      openJob: dto.openJob,
      position: dto.position ?? null,
      categories: dto.category,
      locations: dto.location,
      jobTypes: dto.jobType,
    };
    await this.db
      .insert(resumeJobPreferences)
      .values(values)
      .onConflictDoUpdate({
        target: resumeJobPreferences.resumeId,
        set: values,
      });
  }

  /**
   * The three batch lookups a set of located rows needs — one `inArray` per
   * level rather than an aliased join per table, with the ids deduplicated
   * across every row first. The repo's batch-lookup pattern.
   */
  private async loadPlaceMaps(rows: LocatedRow[]): Promise<PlaceMaps> {
    const provinceIds = new Set<string>();
    const districtIds = new Set<string>();
    const communeIds = new Set<string>();
    for (const row of rows) {
      if (row.provinceId) provinceIds.add(row.provinceId);
      if (row.districtId) districtIds.add(row.districtId);
      if (row.communeId) communeIds.add(row.communeId);
    }

    const [provinceMap, districtMap, communeMap] = await Promise.all([
      this.loadProvincePlaces([...provinceIds]),
      this.loadDistrictPlaces([...districtIds]),
      this.loadCommunePlaces([...communeIds]),
    ]);
    return {
      provinces: provinceMap,
      districts: districtMap,
      communes: communeMap,
    };
  }

  private async loadProvincePlaces(ids: string[]): Promise<Map<string, Place>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({
        id: provinces.id,
        name: provinces.name,
        slug: provinces.slug,
      })
      .from(provinces)
      .where(inArray(provinces.id, ids));
    return toPlaceMap(rows);
  }

  private async loadDistrictPlaces(ids: string[]): Promise<Map<string, Place>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({
        id: districts.id,
        name: districts.name,
        slug: districts.slug,
      })
      .from(districts)
      .where(inArray(districts.id, ids));
    return toPlaceMap(rows);
  }

  private async loadCommunePlaces(ids: string[]): Promise<Map<string, Place>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({
        id: communes.id,
        name: communes.name,
        slug: communes.slug,
      })
      .from(communes)
      .where(inArray(communes.id, ids));
    return toPlaceMap(rows);
  }
}

/**
 * `districtId` without its province, or `communeId` without its district,
 * would store a location the cascade can never render — reject it as a 400
 * rather than silently dropping the id.
 */
function assertChildRelations(relations: {
  provinceId?: string | null;
  districtId?: string | null;
  communeId?: string | null;
}): void {
  if (relations.districtId && !relations.provinceId)
    throw new BadRequestException({
      code: 'RESUME_LOCATION_INCOHERENT',
      message: 'A district requires its province',
    });
  if (relations.communeId && !relations.districtId)
    throw new BadRequestException({
      code: 'RESUME_LOCATION_INCOHERENT',
      message: 'A commune requires its district',
    });
}

/**
 * The dated sections' shared rule, in one place: an entry is either ongoing
 * (end date forced to `null` — the client clears it, but a stale value must
 * not survive) or finished with an end date on or after its start. Returns the
 * end date to store.
 */
function assertDates(
  startDate: string,
  endDate: string | null,
  current: boolean,
): string | null {
  if (current) return null;
  if (!endDate)
    throw new BadRequestException({
      code: 'RESUME_END_DATE_REQUIRED',
      message: 'An end date is required unless the entry is current',
    });
  // Date-only strings compare correctly as strings.
  if (endDate < startDate)
    throw new BadRequestException({
      code: 'RESUME_DATE_ORDER',
      message: 'The end date must be on or after the start date',
    });
  return endDate;
}

interface PlaceMaps {
  provinces: Map<string, Place>;
  districts: Map<string, Place>;
  communes: Map<string, Place>;
}

function toPlaceMap(rows: Place[]): Map<string, Place> {
  return new Map(rows.map((row) => [row.id, row]));
}

/** Attaches the resolved levels to located rows; a missing row reads `null`. */
function attachPlaces<T extends LocatedRow>(
  rows: T[],
  places: PlaceMaps,
): (T & { place: ResumeLocationWire })[] {
  return rows.map((row) => ({
    ...row,
    place: {
      province: row.provinceId
        ? (places.provinces.get(row.provinceId) ?? null)
        : null,
      district: row.districtId
        ? (places.districts.get(row.districtId) ?? null)
        : null,
      commune: row.communeId
        ? (places.communes.get(row.communeId) ?? null)
        : null,
    },
  }));
}

function emptyDocument(): ResumeDocumentWire {
  return {
    exists: false,
    personal: null,
    summary: '',
    hobbies: '',
    experiences: [],
    educations: [],
    skills: [],
    languages: [],
    references: [],
    jobPreference: null,
    attachment: null,
  };
}

function toPersonalWire(
  row: ResumePersonalRow & { place: ResumeLocationWire },
): ResumePersonalWire {
  return {
    firstName: row.firstName,
    lastName: row.lastName,
    gender: row.gender,
    dob: row.dob,
    nationality: row.nationality,
    email: row.email,
    educationLevel: row.educationLevel,
    maritalStatus: row.maritalStatus,
    place: row.place,
    address: row.address,
    position: row.position,
    yearsOfExperience: row.yearsOfExperience,
    phones: row.phones,
    photoUrl: row.photoUrl,
  };
}

function toExperienceWire(
  row: ResumeExperienceRow & { place: ResumeLocationWire },
): ResumeExperienceWire {
  return {
    id: row.id,
    company: row.company,
    position: row.position,
    place: row.place,
    startDate: row.startDate,
    endDate: row.endDate,
    current: row.isCurrent,
    description: row.description,
  };
}

function toEducationWire(
  row: ResumeEducationRow & { place: ResumeLocationWire },
): ResumeEducationWire {
  return {
    id: row.id,
    school: row.school,
    degree: row.degree,
    major: row.major,
    place: row.place,
    startDate: row.startDate,
    endDate: row.endDate,
    current: row.isCurrent,
    description: row.description,
  };
}

function toSkillWire(row: ResumeSkillRow): ResumeSkillWire {
  return { id: row.id, title: row.title, level: row.level };
}

function toLanguageWire(row: ResumeLanguageRow): ResumeLanguageWire {
  return { id: row.id, title: row.title, level: row.level };
}

function toReferenceWire(row: ResumeReferenceRow): ResumeReferenceWire {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    position: row.position,
    phones: row.phones,
    email: row.email,
  };
}

function toJobPreferenceWire(
  row: ResumeJobPreferenceRow,
): ResumeJobPreferenceWire {
  return {
    openJob: row.openJob,
    position: row.position,
    category: row.categories,
    location: row.locations,
    jobType: row.jobTypes,
  };
}

function toAttachmentWire(row: {
  id: string;
  fileName: string;
  actualSize: number | null;
  uploadedAt: Date | null;
  createdAt: Date;
}): ResumeAttachmentWire {
  return {
    id: row.id,
    fileName: row.fileName,
    // `actual_size` is the storage-verified size — the only one there is.
    size: row.actualSize ?? 0,
    uploadedAt: (row.uploadedAt ?? row.createdAt).toISOString(),
  };
}
