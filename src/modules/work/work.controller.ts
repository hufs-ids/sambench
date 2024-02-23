import { TaskDto } from './dto/task.dto';
import { WorkService } from './work.service';

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('work')
@Controller()
export class WorkController {
  constructor(private readonly appService: WorkService) {}

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

  @Get('works/:workId/queries')
  getQueries(@Param('workId') workId: string) {
    return this.appService.getQueries(workId);
  }

  @Get('works/:workId/android/time')
  getWorkAndroidTime(@Param('workId') workId: string) {
    return this.appService.getWorkAndroidTime(workId);
  }

  @Get('works/:workId/host/time')
  getWorkHostTime(@Param('workId') workId: string) {
    return this.appService.getWorkHostTime(workId);
  }

  /**
   * VDBE 정보를 가져옵니다.
   */
  @Get('works/:workId/queries/:queryId/vdbe')
  getVdbe(@Param('workId') workId: string, @Param('queryId') queryId: string) {
    return this.appService.getVdbeProfile({ workId, queryId });
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

  /**
   * 작업을 수행합니다.
   */
  @Post('works')
  doWork(
    @Query('percentageInterval') percentageInterval: number,
    @Query('percentageTo') percentageTo: number,
  ) {
    return this.appService.doWork({
      percentageInterval,
      percentageTo,
    });
  }
  /**
   * Task를 수행합니다.
   */
  @Post('works/:workId/tasks/:taskId')
  doTask(
    @Param('workId') workId: string,
    @Param('taskId') taskId: string,
    @Body() body: TaskDto,
  ) {
    console.log(body);
    return this.appService.doTask({
      workId,
      taskId,
      queries: body.queries,
    });
  }
}
