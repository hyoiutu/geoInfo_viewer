import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FeatureCollection } from 'geojson';
import { assertMunicipalityEra, MUNICIPALITY_ERA_CURRENT } from './era.constants';
import { MUNICIPALITIES_BOUNDARIES_ROUTE, MUNICIPALITIES_ROUTE } from './municipalities.constants';
import { MunicipalitiesService } from './municipalities.service';

/** 市区町村境界データの参照に関するHTTP APIを提供するコントローラー */
@ApiTags('municipalities')
@Controller(MUNICIPALITIES_ROUTE)
export class MunicipalitiesController {
  constructor(private readonly municipalitiesService: MunicipalitiesService) {}

  /** GET /municipalities/boundaries: 指定した年代の市区町村境界をGeoJSONで返す（年代省略時は現行） */
  @Get(MUNICIPALITIES_BOUNDARIES_ROUTE)
  getBoundaries(@Query('era') era: string = MUNICIPALITY_ERA_CURRENT): Promise<FeatureCollection> {
    return this.municipalitiesService.findBoundariesByEra(assertMunicipalityEra(era));
  }
}
