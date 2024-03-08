import { AdbController } from '../adb/adb.controller';

import { TaskDto } from './dto/task.dto';
import { WorkService } from './work.service';

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { workspacePath } from 'src/utils/const';

@ApiTags('work')
@Controller()
export class WorkController {
  constructor(
    private readonly appService: WorkService,
    private readonly adb: AdbController,
  ) {}

  cache = {};

  @Get()
  async getHello(): Promise<string> {
    return 'IDS Android Sqllite Performance Council API Server';
  }

  @Get('works')
  async getWorks(): Promise<string[]> {
    const files = await fs.promises.readdir(workspacePath, {
      withFileTypes: true,
    });
    const folders = files
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
    return folders;
  }

  @Get('works/:workId')
  async getWork(@Param('workId') workId: string): Promise<any> {
    if (this.cache[workId]) {
      return this.cache[workId];
    }
    const workPath = path.resolve(workspacePath, workId);
    const files = await fs.promises.readdir(workPath);
    const fileObj = {};
    for (const file of files) {
      const stats = await fs.promises.stat(path.join(workPath, file));
      if (stats.isDirectory()) {
        fileObj[file] = await this.getTask(workId, file);
      }
    }
    this.cache[workId] = fileObj;
    return fileObj;
  }

  async getTask(workId: string, taskId: string): Promise<any> {
    const taskPath = path.resolve(workspacePath, workId, taskId);
    const files = await fs.promises.readdir(taskPath);
    const fileObj = {};
    for (const file of files) {
      const stats = await fs.promises.stat(path.join(taskPath, file));
      if (stats.isDirectory()) {
        // fileObj[file] = await this.getQueries(workId, taskId, file);
        // todo
      }
    }
    return fileObj;
  }

  @Get('works/:workId/queries')
  async getQueries(@Param('workId') workId: string) {
    return this.appService.getQueries(workId);
  }

  @Get('works/:workId/external-db-sizes')
  async getExternalDbSizes(@Param('workId') workId: string) {
    return this.appService.getExternalDbSizes(workId);
  }

  @Get('works/:workId/android/time')
  async getWorkAndroidTime(@Param('workId') workId: string) {
    return this.appService.getWorkAndroidTime(workId);
  }

  @Get('works/:workId/host/time')
  async getWorkHostTime(@Param('workId') workId: string) {
    return this.appService.getWorkHostTime(workId);
  }

  /**
   * VDBE 정보를 가져옵니다.
   */
  @Get('works/:workId/queries/:queryId/vdbe')
  async getVdbe(
    @Param('workId') workId: string,
    @Param('queryId') queryId: string,
  ) {
    return this.appService.getVdbeProfile({ workId, queryId });
  }

  @Get('test')
  async test() {
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
  async doWork(
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
  async doTask(
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

  /**
   * 해당 Work의 Host 작업을 다시 수행합니다.
   */
  @Post('works/:workId/redo-host-work')
  async redoHostWork(@Param('workId') workId: string, @Body() body: TaskDto) {
    const tasks = await fs.promises.readdir(
      path.resolve(workspacePath, workId),
      {
        withFileTypes: true,
      },
    );

    // clear all host-time.json, vdbe-profile.json, .out

    for (const task of tasks) {
      const queries = await fs.promises.readdir(
        path.resolve(workspacePath, workId, task.name),
        {
          withFileTypes: true,
        },
      );

      for (const query of queries) {
        const queryPath = path.resolve(
          workspacePath,
          workId,
          task.name,
          query.name,
        );
        console.log({ query });
        try {
          const filesToDelete = [
            'host-time.json',
            'vdbe-profile.json',
            'vdbe-profile.out',
          ];
          for (const file of filesToDelete) {
            const filePath = path.join(queryPath, file);
            if (await fs.promises.stat(filePath).catch(() => false)) {
              await fs.promises.unlink(filePath);
              console.log(`Deleted ${filePath}`);
            }
          }
        } catch (err) {
          console.error(err);
        }
      }
    }

    for (const task of tasks) {
      for (const query of body.queries) {
        await this.appService.doQueryOnHost(workId, task.name, query);
      }
    }
  }
}
