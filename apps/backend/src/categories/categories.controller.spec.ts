import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

const mockService = {
  listCategories: jest.fn().mockResolvedValue([]),
  getCategoryBySlug: jest.fn().mockResolvedValue({}),
  getSubcategory: jest.fn().mockResolvedValue({}),
};

describe('CategoriesController', () => {
  let controller: CategoriesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockService.listCategories.mockResolvedValue([]);
    mockService.getCategoryBySlug.mockResolvedValue({});
    mockService.getSubcategory.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: mockService }],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  describe('listCategories', () => {
    const SELLER_ID = '18d78b3e-1767-43b5-b4a0-947c2b5f8e1f';

    it('passes resolved locale to service', async () => {
      await controller.listCategories(undefined, 'km-KH,en;q=0.9');
      expect(mockService.listCategories).toHaveBeenCalledWith('km', undefined);
    });

    it('defaults to en when header is undefined', async () => {
      await controller.listCategories(undefined, undefined);
      expect(mockService.listCategories).toHaveBeenCalledWith('en', undefined);
    });

    it('forwards the seller scope alongside the locale', async () => {
      await controller.listCategories(SELLER_ID, 'km-KH');
      expect(mockService.listCategories).toHaveBeenCalledWith('km', SELLER_ID);
    });
  });

  describe('getCategory', () => {
    it('passes slug and resolved locale to service', async () => {
      await controller.getCategory('cars', 'km-KH,en;q=0.9');
      expect(mockService.getCategoryBySlug).toHaveBeenCalledWith('cars', 'km');
    });

    it('defaults to en for unsupported locale', async () => {
      await controller.getCategory('cars', 'fr');
      expect(mockService.getCategoryBySlug).toHaveBeenCalledWith('cars', 'en');
    });
  });

  describe('getSubcategory', () => {
    it('passes slug, subSlug and resolved locale to service', async () => {
      await controller.getSubcategory('cars', 'sale', 'km-KH');
      expect(mockService.getSubcategory).toHaveBeenCalledWith(
        'cars',
        'sale',
        'km',
      );
    });

    it('defaults to en when header is empty string', async () => {
      await controller.getSubcategory('cars', 'sale', '');
      expect(mockService.getSubcategory).toHaveBeenCalledWith(
        'cars',
        'sale',
        'en',
      );
    });
  });
});
