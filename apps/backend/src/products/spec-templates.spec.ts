import { BadRequestException } from '@nestjs/common';
import {
  FAMILY_SUBCATEGORY_SLUG,
  PRODUCT_SPEC_TEMPLATES,
  getFamilyForSubcategorySlug,
  getProductSpecTemplate,
  isTemplateGroup,
} from './spec-templates';

it('defines all five families with their subcategory slugs', () => {
  expect(Object.keys(PRODUCT_SPEC_TEMPLATES).sort()).toEqual([
    'car',
    'motorcycle',
    'phone',
    'smartwatch',
    'tablet',
  ]);
  expect(FAMILY_SUBCATEGORY_SLUG).toEqual({
    car: 'cars-for-sale',
    motorcycle: 'motorcycles-for-sale',
    phone: 'phones',
    tablet: 'tablets',
    smartwatch: 'smart-watches',
  });
});

it('gives every section unique field keys and labels', () => {
  for (const template of Object.values(PRODUCT_SPEC_TEMPLATES)) {
    for (const section of template.sections) {
      const keys = section.fields.map((f) => f.key);
      const labels = section.fields.map((f) => f.label);
      expect(new Set(keys).size).toBe(keys.length);
      expect(new Set(labels).size).toBe(labels.length);
    }
  }
});

it('accepts a filled subset of a template section and rejects foreign groups', () => {
  expect(
    isTemplateGroup('phone', {
      title: 'Display',
      rows: [{ label: 'Size' }, { label: 'Resolution' }],
    }),
  ).toBe(true);
  expect(
    isTemplateGroup('phone', {
      title: 'Display',
      rows: [{ label: 'Nope' }],
    }),
  ).toBe(false);
  expect(
    isTemplateGroup('phone', {
      title: 'Camera',
      rows: [{ label: 'Size' }],
    }),
  ).toBe(false);
  expect(
    isTemplateGroup('phone', {
      title: 'Display',
      rows: [{ label: 'Size' }, { label: 'Size' }],
    }),
  ).toBe(false);
});

it('resolves families from subcategory slugs and rejects unknown ones', () => {
  expect(getFamilyForSubcategorySlug('phones')).toBe('phone');
  expect(getFamilyForSubcategorySlug('laptops')).toBeNull();
  expect(() => getProductSpecTemplate('nope' as never)).toThrow(
    BadRequestException,
  );
});

it('maps the template labels from the design document', () => {
  expect(PRODUCT_SPEC_TEMPLATES.phone.sections.map((s) => s.title)).toEqual([
    'Network',
    'Launch',
    'Body',
    'Display',
    'Platform',
    'Memory',
    'Main Camera',
    'Selfie Camera',
    'Sound',
    'Comms',
    'Features',
    'Battery',
    'Misc',
  ]);
});

it('marks Car and Motorcycle freeform and the device families templated', () => {
  expect(PRODUCT_SPEC_TEMPLATES.car.mode).toBe('freeform');
  expect(PRODUCT_SPEC_TEMPLATES.car.sections).toEqual([]);
  expect(PRODUCT_SPEC_TEMPLATES.motorcycle.mode).toBe('freeform');
  expect(PRODUCT_SPEC_TEMPLATES.motorcycle.sections).toEqual([]);
  expect(PRODUCT_SPEC_TEMPLATES.phone.mode).toBe('template');
  expect(PRODUCT_SPEC_TEMPLATES.tablet.mode).toBe('template');
  expect(PRODUCT_SPEC_TEMPLATES.smartwatch.mode).toBe('template');
});
