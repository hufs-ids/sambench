import { AdbService } from './adb.service';

import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('adb')
@Controller('adb')
export class AdbController {
  constructor(readonly adbService: AdbService) {}

  @Get('devices')
  getDevices() {
    return this.adbService.getDevices();
  }

  @Get('devices/selected')
  getSelectedDeviceId() {
    return this.adbService.getSelectedDeviceId();
  }

  @Post('devices/:deviceId/select')
  selectDevice(@Param('deviceId') deviceId: string) {
    return this.adbService.selectDevice(deviceId);
  }

  @Post('device/connect-over-wifi')
  connectOverWifi() {
    return this.adbService.connectOverWifi();
  }

  @Get('storage/percentage')
  getStoragePercentage() {
    return this.adbService.getStoragePercentage();
  }

  @Post('storage/generate-batch')
  async generateStorageBatch(@Query('count') count: number) {
    const totalCount = await this.adbService.generateStorageBatch(count);

    return {
      count: totalCount,
    };
  }

  @Post('storage/fill')
  async fillStorage(@Query('targetPercentage') targetPercentage: number) {
    return await this.adbService.fillStorage(targetPercentage);
  }

  @Post('storage/drain')
  async removeStorage(@Query('targetPercentage') targetPercentage: number) {
    return await this.adbService.drainStorage(targetPercentage);
  }

  @Get('metrics')
  getMetrics() {
    return this.adbService.getMetrics();
  }

  @Get('count-of-pending')
  getCountOfPending() {
    return this.adbService.getCountOfPending();
  }
}
