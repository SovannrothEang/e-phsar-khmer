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
    it('passes resolved locale to service', async () => {
      await controller.listCategories('km-KH,en;q=0.9');
      expect(mockService.listCategories).toHaveBeenCalledWith('km');
    });

    it('defaults to en when header is undefined', async () => {
      await controller.listCategories(undefined);
      expect(mockService.listCategories).toHaveBeenCalledWith('en');
    });
  });

  describe('getCategory', () => {
    it('passes slug and resolved locale to service', async () => {
      await controller.getCategory('cars', 'zh-CN,en;q=0.8');
      expect(mockService.getCategoryBySlug).toHaveBeenCalledWith('cars', 'zh');
    });

    it('defaults to en for unsupported locale', async () => {
      await controller.getCategory('cars', 'fr');
      expect(mockService.getCategoryBySlug).toHaveBeenCalledWith('cars', 'en');
    });
  });

  describe('getSubcategory', () => {
    it('passes slug, subSlug and resolved locale to service', async () => {
      await controller.getSubcategory('cars', 'sale', 'zh-CN');
      expect(mockService.getSubcategory).toHaveBeenCalledWith(
        'cars',
        'sale',
        'zh',
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
