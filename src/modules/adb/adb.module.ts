import { WorkRepository } from '../work/work.repository';

import { AdbController } from './adb.controller';

import { Module } from '@nestjs/common';

@Module({
  controllers: [AdbController],
  providers: [AdbController, WorkRepository],
  exports: [AdbController],
})
export class AdbModule {}
