import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('works')
  getWorks() {
    return this.appService.getWorks();
  }

  @Get('works/:workId')
  getWork(@Param('workId') workId: string) {
    return this.appService.getWork(workId);
  }

  @Get('works/:workId/android/time')
  getWorkAndroidTime(@Param('workId') workId: string) {
    return this.appService.getWorkAndroidTime(workId);
  }

  @Get('test')
  test() {
    return [
      { percentage: 0, a: 120, b: 150 },
      { percentage: 10, a: 130, b: 160 },
      { percentage: 20, a: 140, b: 170 },
      { percentage: 30, a: 150, b: 180 },
      { percentage: 40, a: 160, b: 190 },
      { percentage: 50, a: 170, b: 200 },
      { percentage: 60, a: 180, b: 210 },
      { percentage: 70, a: 190, b: 220 },
      { percentage: 80, a: 200, b: 230 },
      { percentage: 90, a: 210, b: 240 },
      { percentage: 100, a: 220, b: 250 },
    ];
  }
}
