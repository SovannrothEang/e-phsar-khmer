// Reflect.getMetadata returns any; prototype method access is intentional in tests.
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

const mockService = {
  listProvinces: jest.fn().mockResolvedValue([]),
  listDistrictsByProvince: jest.fn().mockResolvedValue([]),
  listCommunesByDistrict: jest.fn().mockResolvedValue([]),
};

describe('LocationsController', () => {
  let controller: LocationsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockService.listProvinces.mockResolvedValue([]);
    mockService.listDistrictsByProvince.mockResolvedValue([]);
    mockService.listCommunesByDistrict.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationsController],
      providers: [{ provide: LocationsService, useValue: mockService }],
    }).compile();

    controller = module.get<LocationsController>(LocationsController);
  });

  describe('listProvinces', () => {
    it('delegates to service and returns result', async () => {
      const provinces = [{ id: 'p1', name: 'Phnom Penh', slug: 'phnom-penh' }];
      mockService.listProvinces.mockResolvedValue(provinces);

      const result = await controller.listProvinces();
      expect(mockService.listProvinces).toHaveBeenCalledWith();
      expect(result).toBe(provinces);
    });

    it('is marked @Public()', () => {
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        LocationsController.prototype.listProvinces,
      );
      expect(isPublic).toBe(true);
    });
  });

  describe('listDistricts', () => {
    it('passes province slug to service', async () => {
      await controller.listDistricts('phnom-penh');
      expect(mockService.listDistrictsByProvince).toHaveBeenCalledWith(
        'phnom-penh',
      );
    });

    it('returns service result unchanged', async () => {
      const districts = [
        {
          id: 'd1',
          name: 'Chamkar Mon',
          slug: 'chamkar-mon',
          provinceId: 'p1',
        },
      ];
      mockService.listDistrictsByProvince.mockResolvedValue(districts);

      const result = await controller.listDistricts('phnom-penh');
      expect(result).toBe(districts);
    });

    it('is marked @Public()', () => {
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        LocationsController.prototype.listDistricts,
      );
      expect(isPublic).toBe(true);
    });
  });

  describe('listCommunes', () => {
    it('passes province and district slugs to service', async () => {
      await controller.listCommunes('phnom-penh', 'chamkar-mon');
      expect(mockService.listCommunesByDistrict).toHaveBeenCalledWith(
        'phnom-penh',
        'chamkar-mon',
      );
    });

    it('returns service result unchanged', async () => {
      const communes = [
        {
          id: 'c1',
          name: 'Tonle Bassac',
          slug: 'tonle-bassac',
          districtId: 'd1',
        },
      ];
      mockService.listCommunesByDistrict.mockResolvedValue(communes);

      const result = await controller.listCommunes('phnom-penh', 'chamkar-mon');
      expect(result).toBe(communes);
    });

    it('is marked @Public()', () => {
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        LocationsController.prototype.listCommunes,
      );
      expect(isPublic).toBe(true);
    });
  });
});
