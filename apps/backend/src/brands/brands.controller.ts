import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { BrandsService } from './brands.service';

@ApiTags('brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List brands, optionally filtered by subcategory slug',
  })
  listBrands(@Query('subcategory') subcategory?: string) {
    return this.brandsService.listBrands(subcategory);
  }

  @Get(':id/models')
  @Public()
  @ApiOperation({
    summary:
      'List models for a brand, optionally narrowed to a subcategory slug',
  })
  listModels(
    @Param('id') id: string,
    @Query('subcategory') subcategory?: string,
  ) {
    return this.brandsService.listModels(id, subcategory);
  }
}
