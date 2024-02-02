import { WorkController } from './work.controller';
import { WorkRepository } from './work.repository';
import { WorkService } from './work.service';

import { Module } from '@nestjs/common';

@Module({
  controllers: [WorkController],
  providers: [WorkService, WorkRepository],
})
export class WorkModule {}
