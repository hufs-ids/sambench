import { HostController } from './host.controller';

import { Module } from '@nestjs/common';

@Module({
  controllers: [HostController],
  providers: [HostController],
  exports: [HostController],
})
export class HostModule {}
