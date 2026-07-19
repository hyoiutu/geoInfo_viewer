import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { GoogleDriveController } from './google-drive.controller';
import { GoogleDriveApiClient } from './google-drive-api.client';
import { GoogleDriveAuthService } from './google-drive-auth.service';
import { GoogleDriveFilesService } from './google-drive-files.service';

@Module({
  imports: [HttpModule],
  controllers: [GoogleDriveController],
  providers: [GoogleDriveApiClient, GoogleDriveAuthService, GoogleDriveFilesService]
})
export class GoogleDriveModule {}
