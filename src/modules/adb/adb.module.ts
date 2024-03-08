import { AdbController } from './adb.controller';

import { Module } from '@nestjs/common';

@Module({
  controllers: [AdbController],
  providers: [AdbController],
  exports: [AdbController],
})
export class AdbModule {}
