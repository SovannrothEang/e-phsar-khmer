import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { LocationsService } from './locations.service';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('provinces')
  @Public()
  @ApiOperation({ summary: 'List all provinces' })
  listProvinces() {
    return this.locationsService.listProvinces();
  }

  @Get('provinces/:slug/districts')
  @Public()
  @ApiOperation({ summary: 'List districts for a province' })
  listDistricts(@Param('slug') slug: string) {
    return this.locationsService.listDistrictsByProvince(slug);
  }

  @Get('provinces/:pSlug/districts/:dSlug/communes')
  @Public()
  @ApiOperation({ summary: 'List communes for a district within a province' })
  listCommunes(@Param('pSlug') pSlug: string, @Param('dSlug') dSlug: string) {
    return this.locationsService.listCommunesByDistrict(pSlug, dSlug);
  }
}
