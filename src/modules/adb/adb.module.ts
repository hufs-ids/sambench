import { AdbController } from './adb.controller';
import { AdbService } from './adb.service';

import { Module } from '@nestjs/common';

@Module({
  controllers: [AdbController],
  providers: [AdbService],
  exports: [AdbService],
})
export class AdbModule {}
