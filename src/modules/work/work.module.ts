import { AdbModule } from '../adb/adb.module';

import { WorkController } from './work.controller';
import { WorkRepository } from './work.repository';

import { Module } from '@nestjs/common';

@Module({
  imports: [AdbModule],
  controllers: [WorkController],
  providers: [WorkController, WorkRepository],
  exports: [WorkController],
})
export class WorkModule {}
