import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AttributesService } from './attributes.service';

@ApiTags('attributes')
@Controller('attributes')
export class PublicAttributesController {
  constructor(private readonly service: AttributesService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List attribute options linked to a subcategory (public)',
  })
  listForSubcategory(
    @Query('subcategoryId', new ParseUUIDPipe()) subcategoryId: string,
  ) {
    return this.service.listBySubcategory(subcategoryId);
  }

  @Get(':type')
  @Public()
  @ApiOperation({ summary: 'List options for an attribute type (public)' })
  list(@Param('type') type: string) {
    return this.service.list(type);
  }
}
