import { NotFoundException } from '@nestjs/common';
import { LocationsService } from './locations.service';

function makeDb() {
  return { select: jest.fn() };
}

function makeService(db: ReturnType<typeof makeDb>) {
  return new LocationsService(db as never);
}

describe('LocationsService', () => {
  let db: ReturnType<typeof makeDb>;
  let service: LocationsService;

  beforeEach(() => {
    db = makeDb();
    service = makeService(db);
  });

  describe('listProvinces', () => {
    it('returns empty array when no provinces', async () => {
      db.select.mockReturnValue({
        from: () => ({ orderBy: () => Promise.resolve([]) }),
      });

      const result = await service.listProvinces();
      expect(result).toEqual([]);
    });

    it('maps rows to ProvinceDto shape', async () => {
      const row = { id: 'p1', name: 'Phnom Penh', slug: 'phnom-penh' };
      db.select.mockReturnValue({
        from: () => ({ orderBy: () => Promise.resolve([row]) }),
      });

      const result = await service.listProvinces();
      expect(result).toEqual([
        { id: 'p1', name: 'Phnom Penh', slug: 'phnom-penh' },
      ]);
    });
  });

  describe('listDistrictsByProvince', () => {
    it('throws NotFoundException when province slug not found', async () => {
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      });

      await expect(service.listDistrictsByProvince('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns empty array when province has no districts', async () => {
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([{ id: 'prov-1' }]),
              }),
            }),
          };
        }
        return {
          from: () => ({
            where: () => ({ orderBy: () => Promise.resolve([]) }),
          }),
        };
      });

      const result = await service.listDistrictsByProvince('phnom-penh');
      expect(result).toEqual([]);
    });

    it('maps rows to DistrictDto shape', async () => {
      const districtRow = {
        id: 'd1',
        name: 'Chamkar Mon',
        slug: 'chamkar-mon',
        provinceId: 'prov-1',
      };
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([{ id: 'prov-1' }]),
              }),
            }),
          };
        }
        return {
          from: () => ({
            where: () => ({ orderBy: () => Promise.resolve([districtRow]) }),
          }),
        };
      });

      const result = await service.listDistrictsByProvince('phnom-penh');
      expect(result).toEqual([
        {
          id: 'd1',
          name: 'Chamkar Mon',
          slug: 'chamkar-mon',
          provinceId: 'prov-1',
        },
      ]);
    });
  });

  describe('listCommunesByDistrict', () => {
    it('throws NotFoundException when province slug not found', async () => {
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      });

      await expect(
        service.listCommunesByDistrict('unknown', 'any'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when district slug not found in province', async () => {
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([{ id: 'prov-1' }]),
              }),
            }),
          };
        }
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve([]) }),
          }),
        };
      });

      await expect(
        service.listCommunesByDistrict('phnom-penh', 'unknown'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns empty array when district has no communes (not yet seeded)', async () => {
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([{ id: 'prov-1' }]),
              }),
            }),
          };
        }
        if (selectCall === 2) {
          return {
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([{ id: 'dist-1' }]),
              }),
            }),
          };
        }
        return {
          from: () => ({
            where: () => ({ orderBy: () => Promise.resolve([]) }),
          }),
        };
      });

      const result = await service.listCommunesByDistrict(
        'phnom-penh',
        'chamkar-mon',
      );
      expect(result).toEqual([]);
    });

    it('maps rows to CommuneDto shape', async () => {
      const communeRow = {
        id: 'c1',
        name: 'Tonle Bassac',
        slug: 'tonle-bassac',
        districtId: 'dist-1',
      };
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([{ id: 'prov-1' }]),
              }),
            }),
          };
        }
        if (selectCall === 2) {
          return {
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([{ id: 'dist-1' }]),
              }),
            }),
          };
        }
        return {
          from: () => ({
            where: () => ({ orderBy: () => Promise.resolve([communeRow]) }),
          }),
        };
      });

      const result = await service.listCommunesByDistrict(
        'phnom-penh',
        'chamkar-mon',
      );
      expect(result).toEqual([
        {
          id: 'c1',
          name: 'Tonle Bassac',
          slug: 'tonle-bassac',
          districtId: 'dist-1',
        },
      ]);
    });
  });
});
