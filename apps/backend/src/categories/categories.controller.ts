import { Controller, Get, Headers, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CategoriesService } from './categories.service';
import { resolveLocale } from './locale.util';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all active categories with subcategories' })
  listCategories(@Headers('accept-language') acceptLanguage?: string) {
    return this.categoriesService.listCategories(resolveLocale(acceptLanguage));
  }

  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Get category by slug' })
  getCategory(
    @Param('slug') slug: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.categoriesService.getCategoryBySlug(
      slug,
      resolveLocale(acceptLanguage),
    );
  }

  @Get(':slug/subcategories/:subSlug')
  @Public()
  @ApiOperation({ summary: 'Get subcategory by slug (includes field_schema)' })
  getSubcategory(
    @Param('slug') slug: string,
    @Param('subSlug') subSlug: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.categoriesService.getSubcategory(
      slug,
      subSlug,
      resolveLocale(acceptLanguage),
    );
  }
}
