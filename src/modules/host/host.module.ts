import { HostService } from './host.service';

import { Module } from '@nestjs/common';
import { HostController } from './host.controller';

@Module({
  providers: [HostService],
  exports: [HostService],
  controllers: [HostController],
})
export class HostModule {}
