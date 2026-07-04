import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { buildUsernameBase, generateUniqueUsername } from './username.util';
import { randomUUID } from 'node:crypto';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import {
  communes,
  districts,
  userPhones,
  users,
} from '../db/schema/users.schema';
import type { UserRow, UserPhoneRow } from '../db/schema/users.schema';
import { SupabaseService } from '../common/supabase/supabase.service';
import { ConfigService } from '@nestjs/config';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { AddPhoneDto } from './dto/add-phone.dto';
import type { PublicUser } from '../auth/auth.service';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  async findById(id: string): Promise<PublicUser> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');
    return this.toPublicUser(user);
  }

  async findByUsernameOrPhone(identifier: string): Promise<UserRow | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.username, identifier), isNull(users.deletedAt)))
      .limit(1);
    if (user) return user;

    const [byPhone] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.primaryPhone, identifier), isNull(users.deletedAt)))
      .limit(1);
    return byPhone ?? null;
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    const hasLocationChange =
      dto.provinceId !== undefined ||
      dto.districtId !== undefined ||
      dto.communeId !== undefined;
    const hasNameChange =
      dto.firstName !== undefined || dto.lastName !== undefined;

    let currentUser: UserRow | undefined;

    if (hasLocationChange || hasNameChange) {
      [currentUser] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!currentUser) throw new NotFoundException('User not found');
    }

    if (hasLocationChange) {
      await this.validateLocationHierarchy(currentUser!, dto);
    }

    const updateData: Partial<UserRow> = {};

    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.gender !== undefined) updateData.gender = dto.gender;
    if (dto.yearOfBirth !== undefined) updateData.yearOfBirth = dto.yearOfBirth;
    if (dto.company !== undefined) updateData.company = dto.company;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.provinceId !== undefined) updateData.provinceId = dto.provinceId;
    if (dto.districtId !== undefined) updateData.districtId = dto.districtId;
    if (dto.communeId !== undefined) updateData.communeId = dto.communeId;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.latitude !== undefined) updateData.latitude = String(dto.latitude);
    if (dto.longitude !== undefined)
      updateData.longitude = String(dto.longitude);
    if (dto.preferredLanguage !== undefined)
      updateData.preferredLanguage = dto.preferredLanguage;

    if (hasNameChange && currentUser && currentUser.username === null) {
      const effFirst = dto.firstName ?? currentUser.firstName;
      const effLast = dto.lastName ?? currentUser.lastName;
      const base = buildUsernameBase(effFirst, effLast);
      if (base !== null) {
        updateData.username = await generateUniqueUsername(this.db, base);
      }
    }

    updateData.updatedAt = new Date();

    const [updated] = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    if (!updated) throw new NotFoundException('User not found');
    return this.toPublicUser(updated);
  }

  async listPhones(userId: string): Promise<UserPhoneRow[]> {
    return this.db
      .select()
      .from(userPhones)
      .where(eq(userPhones.userId, userId));
  }

  async addPhone(userId: string, dto: AddPhoneDto): Promise<UserPhoneRow> {
    const [existing] = await this.db
      .select()
      .from(userPhones)
      .where(eq(userPhones.phone, dto.phone))
      .limit(1);
    if (existing) throw new ConflictException('Phone already in use');

    const [hasAny] = await this.db
      .select({ id: userPhones.id })
      .from(userPhones)
      .where(eq(userPhones.userId, userId))
      .limit(1);
    const makePrimary = dto.isPrimary ?? !hasAny;

    if (makePrimary) {
      await this.db
        .update(userPhones)
        .set({ isPrimary: false })
        .where(eq(userPhones.userId, userId));
    }

    const [created] = await this.db
      .insert(userPhones)
      .values({ userId, phone: dto.phone, isPrimary: makePrimary })
      .returning();
    return created;
  }

  async removePhone(
    userId: string,
    phoneId: string,
  ): Promise<{ removed: true }> {
    const [deleted] = await this.db
      .delete(userPhones)
      .where(and(eq(userPhones.id, phoneId), eq(userPhones.userId, userId)))
      .returning();
    if (!deleted) throw new NotFoundException('Phone not found');
    return { removed: true };
  }

  async setPrimaryPhone(
    userId: string,
    phoneId: string,
  ): Promise<UserPhoneRow> {
    const [target] = await this.db
      .select()
      .from(userPhones)
      .where(and(eq(userPhones.id, phoneId), eq(userPhones.userId, userId)))
      .limit(1);
    if (!target) throw new NotFoundException('Phone not found');

    await this.db
      .update(userPhones)
      .set({ isPrimary: false })
      .where(eq(userPhones.userId, userId));

    const [updated] = await this.db
      .update(userPhones)
      .set({ isPrimary: true })
      .where(eq(userPhones.id, phoneId))
      .returning();
    return updated;
  }

  async setProfilePhoto(
    userId: string,
    file: Express.Multer.File,
  ): Promise<PublicUser> {
    this.validateImageFile(file);
    const bucket =
      this.configService.get<string>('supabase.storageBucket') ?? 'listings';
    const path = `avatar/${userId}/${randomUUID()}-${this.safeName(file.originalname)}`;

    const { error } = await this.supabaseService.uploadObject(
      bucket,
      path,
      file.buffer,
      file.mimetype,
    );
    if (error) throw new ForbiddenException('Failed to upload profile photo');

    const { data } = this.supabaseService.getPublicUrl(bucket, path);
    const [updated] = await this.db
      .update(users)
      .set({ profilePhotoUrl: data.publicUrl, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    return this.toPublicUser(updated);
  }

  async setCoverPhoto(
    userId: string,
    file: Express.Multer.File,
  ): Promise<PublicUser> {
    this.validateImageFile(file);
    const bucket =
      this.configService.get<string>('supabase.storageBucket') ?? 'listings';
    const path = `cover/${userId}/${randomUUID()}-${this.safeName(file.originalname)}`;

    const { error } = await this.supabaseService.uploadObject(
      bucket,
      path,
      file.buffer,
      file.mimetype,
    );
    if (error) throw new ForbiddenException('Failed to upload cover photo');

    const { data } = this.supabaseService.getPublicUrl(bucket, path);
    const [updated] = await this.db
      .update(users)
      .set({ coverPhotoUrl: data.publicUrl, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    return this.toPublicUser(updated);
  }

  private async validateLocationHierarchy(
    currentUser: UserRow,
    dto: UpdateProfileDto,
  ): Promise<void> {
    const effectiveProvinceId = dto.provinceId ?? currentUser.provinceId;
    const effectiveDistrictId = dto.districtId ?? currentUser.districtId;
    const effectiveCommuneId = dto.communeId ?? currentUser.communeId;

    if (
      effectiveDistrictId &&
      effectiveProvinceId &&
      (dto.districtId !== undefined || dto.provinceId !== undefined)
    ) {
      const [d] = await this.db
        .select({ provinceId: districts.provinceId })
        .from(districts)
        .where(eq(districts.id, effectiveDistrictId))
        .limit(1);
      if (!d || d.provinceId !== effectiveProvinceId) {
        throw new BadRequestException('INVALID_LOCATION_HIERARCHY');
      }
    }

    if (
      effectiveCommuneId &&
      effectiveDistrictId &&
      (dto.communeId !== undefined || dto.districtId !== undefined)
    ) {
      const [c] = await this.db
        .select({ districtId: communes.districtId })
        .from(communes)
        .where(eq(communes.id, effectiveCommuneId))
        .limit(1);
      if (!c || c.districtId !== effectiveDistrictId) {
        throw new BadRequestException('INVALID_LOCATION_HIERARCHY');
      }
    }
  }

  private validateImageFile(file: Express.Multer.File) {
    if (!file.mimetype.startsWith('image/')) {
      throw new ForbiddenException('Only image files are allowed');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new ForbiddenException('File size must not exceed 5MB');
    }
  }

  private safeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  }

  private toPublicUser(user: UserRow): PublicUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, ...publicUser } = user;
    return publicUser;
  }
}
