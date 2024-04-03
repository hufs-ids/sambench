import { AdbController } from '../adb/adb.controller';

import {
  Controller,
  NotImplementedException,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Controller for ADB operations.
 */
@Controller()
export class PublicController {
  constructor(private readonly adb: AdbController) {}

  /**
   * Adjusts multiple settings of the device.
   */
  @ApiTags('Configurations')
  @Post('config')
  async adjustAll(
    @Query('Capacity') targetStoragePercent: number,
    @Query('Fragmentation') targetFragmantationPercent: number,
    @Query('CPU-intensive') cpuIntencive: boolean,
  ) {
    throw new NotImplementedException();
  }

  @ApiTags('Evaluate')
  @Post('evaluate')
  async configWork(
    @Query('Config-id') configId: string,
    @Query('Query-id') queryId: string,
    @Query('Capacity') capacity: number,
  ) {
    throw new NotImplementedException();
  }
}
