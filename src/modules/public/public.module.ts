import { AdbModule } from '../adb/adb.module';
import { WorkModule } from '../work/work.module';

import { PublicController } from './public.controller';

import { Module } from '@nestjs/common';

@Module({
  imports: [AdbModule, WorkModule],
  controllers: [PublicController],
  providers: [PublicController],
  exports: [PublicController],
})
export class PublicModule {}
