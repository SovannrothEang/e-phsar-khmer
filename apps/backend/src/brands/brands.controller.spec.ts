// Reflect.getMetadata returns any; prototype method access is intentional in tests.
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

const mockService = {
  listBrands: jest.fn().mockResolvedValue([]),
  listModels: jest.fn().mockResolvedValue([]),
};

describe('BrandsController', () => {
  let controller: BrandsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockService.listBrands.mockResolvedValue([]);
    mockService.listModels.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrandsController],
      providers: [{ provide: BrandsService, useValue: mockService }],
    }).compile();

    controller = module.get<BrandsController>(BrandsController);
  });

  describe('listBrands', () => {
    it('delegates to service with subcategory value', async () => {
      const result = [
        { id: 'b1', slug: 'apple', name: 'Apple', icon: null, sortOrder: 0 },
      ];
      mockService.listBrands.mockResolvedValue(result);

      const res = await controller.listBrands('phones');
      expect(mockService.listBrands).toHaveBeenCalledWith('phones');
      expect(res).toBe(result);
    });

    it('delegates to service with undefined when no subcategory', async () => {
      await controller.listBrands(undefined);
      expect(mockService.listBrands).toHaveBeenCalledWith(undefined);
    });

    it('is marked @Public()', () => {
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        BrandsController.prototype.listBrands,
      );
      expect(isPublic).toBe(true);
    });
  });

  describe('listModels', () => {
    it('passes brand id to service and returns result', async () => {
      const result = [
        { id: 'm1', slug: 'iphone-15', name: 'iPhone 15', sortOrder: 0 },
      ];
      mockService.listModels.mockResolvedValue(result);

      const res = await controller.listModels('brand-uuid');
      expect(mockService.listModels).toHaveBeenCalledWith('brand-uuid');
      expect(res).toBe(result);
    });

    it('is marked @Public()', () => {
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        BrandsController.prototype.listModels,
      );
      expect(isPublic).toBe(true);
    });
  });
});
