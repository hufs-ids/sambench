import { AdbService } from './adb.service';

import { Controller, Get, Param, Post } from '@nestjs/common';
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
  async generateStorageBatch() {
    const count = await this.adbService.generateStorageBatch();

    return {
      count,
    };
  }

  @Get('metrics')
  getMetrics() {
    return this.adbService.getMetrics();
  }
}
