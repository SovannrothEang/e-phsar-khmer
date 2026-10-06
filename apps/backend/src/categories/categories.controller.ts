import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
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
  @ApiOperation({
    summary:
      'List all active categories with subcategories (optionally scoped to ' +
      "one seller's active listings via ?userId=)",
  })
  listCategories(
    /**
     * Scope the tree to this seller — the public profile's category strip,
     * which needs the categories they posted in **and** the subcategories
     * they posted in under each.
     *
     * Read as a single named param rather than through a DTO on purpose: this
     * route took no `@Query()` at all before, and `forbidNonWhitelisted` is
     * global, so a DTO would start rejecting every stray key (`?foo=1`, a
     * cache-buster) that the endpoint has always ignored.
     */
    @Query('userId', new ParseUUIDPipe({ optional: true })) userId?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.categoriesService.listCategories(
      resolveLocale(acceptLanguage),
      userId,
    );
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
