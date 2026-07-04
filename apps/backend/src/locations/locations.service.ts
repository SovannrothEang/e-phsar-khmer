import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { communes, districts, provinces } from '../db/schema/users.schema';

export interface ProvinceDto {
  id: string;
  name: string;
  slug: string;
}

export interface DistrictDto {
  id: string;
  name: string;
  slug: string;
  provinceId: string;
}

export interface CommuneDto {
  id: string;
  name: string;
  slug: string;
  districtId: string;
}

@Injectable()
export class LocationsService {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  async listProvinces(): Promise<ProvinceDto[]> {
    const rows = await this.db
      .select()
      .from(provinces)
      .orderBy(asc(provinces.name));
    return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug }));
  }

  async listDistrictsByProvince(provinceSlug: string): Promise<DistrictDto[]> {
    const [province] = await this.db
      .select({ id: provinces.id })
      .from(provinces)
      .where(eq(provinces.slug, provinceSlug))
      .limit(1);

    if (!province) {
      throw new NotFoundException(`Province '${provinceSlug}' not found`);
    }

    const rows = await this.db
      .select()
      .from(districts)
      .where(eq(districts.provinceId, province.id))
      .orderBy(asc(districts.name));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      provinceId: r.provinceId,
    }));
  }

  async listCommunesByDistrict(
    provinceSlug: string,
    districtSlug: string,
  ): Promise<CommuneDto[]> {
    const [province] = await this.db
      .select({ id: provinces.id })
      .from(provinces)
      .where(eq(provinces.slug, provinceSlug))
      .limit(1);

    if (!province) {
      throw new NotFoundException(`Province '${provinceSlug}' not found`);
    }

    const [district] = await this.db
      .select({ id: districts.id })
      .from(districts)
      .where(
        and(
          eq(districts.provinceId, province.id),
          eq(districts.slug, districtSlug),
        ),
      )
      .limit(1);

    if (!district) {
      throw new NotFoundException(`District '${districtSlug}' not found`);
    }

    const rows = await this.db
      .select()
      .from(communes)
      .where(eq(communes.districtId, district.id))
      .orderBy(asc(communes.name));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      districtId: r.districtId,
    }));
  }
}
