import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MunicipalityEntity } from './entities/municipality.entity';
import { MunicipalitiesService } from './municipalities.service';

@Module({
  imports: [TypeOrmModule.forFeature([MunicipalityEntity])],
  providers: [MunicipalitiesService],
  exports: [MunicipalitiesService]
})
export class MunicipalitiesModule {}
