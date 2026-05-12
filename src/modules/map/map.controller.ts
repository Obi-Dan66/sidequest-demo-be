import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { MapBoundsQueryDto } from './dto/map-query.dto';
import { MapPinDto } from './dto/map-pin.dto';
import { MapService } from './map.service';

@ApiTags('map')
@Controller({ path: 'map', version: '1' })
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Public()
  @Get('pins')
  @ApiOperation({ summary: 'Get map pins inside a viewport bounding box' })
  async getPins(@Query() query: MapBoundsQueryDto): Promise<MapPinDto[]> {
    return this.mapService.getPinsInBounds(query);
  }
}
