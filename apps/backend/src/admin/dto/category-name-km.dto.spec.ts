import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';
import { CreateSubcategoryDto } from './create-subcategory.dto';
import { UpdateCategoryDto } from './update-category.dto';
import { UpdateSubcategoryDto } from './update-subcategory.dto';

const CATEGORY_ID = '00000000-0000-4000-8000-000000000000';

const validCategory = { slug: 'test-category', name: 'Test Category' };
const validSubcategory = {
  categoryId: CATEGORY_ID,
  slug: 'test-subcategory',
  name: 'Test Subcategory',
};

describe('category nameKm validation', () => {
  it('accepts a Khmer name on every category DTO', async () => {
    const results = await Promise.all([
      validate(
        plainToInstance(CreateCategoryDto, {
          ...validCategory,
          nameKm: 'រថយន្ត',
        }),
      ),
      validate(plainToInstance(UpdateCategoryDto, { nameKm: 'រថយន្ត' })),
      validate(
        plainToInstance(CreateSubcategoryDto, {
          ...validSubcategory,
          nameKm: 'រថយន្ត',
        }),
      ),
      validate(plainToInstance(UpdateSubcategoryDto, { nameKm: 'រថយន្ត' })),
    ]);

    for (const errors of results) expect(errors).toHaveLength(0);
  });

  it('accepts an empty nameKm so a km row can be cleared', async () => {
    const errors = await validate(
      plainToInstance(UpdateCategoryDto, { nameKm: '' }),
    );

    expect(errors).toHaveLength(0);
  });

  it('rejects an over-long nameKm on every category DTO', async () => {
    const nameKm = 'ក'.repeat(201);
    const results = await Promise.all([
      validate(
        plainToInstance(CreateCategoryDto, { ...validCategory, nameKm }),
      ),
      validate(plainToInstance(UpdateCategoryDto, { nameKm })),
      validate(
        plainToInstance(CreateSubcategoryDto, { ...validSubcategory, nameKm }),
      ),
      validate(plainToInstance(UpdateSubcategoryDto, { nameKm })),
    ]);

    for (const errors of results) {
      expect(errors.some((e) => e.property === 'nameKm')).toBe(true);
    }
  });
});
