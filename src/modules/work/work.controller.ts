import { AdbController } from '../adb/adb.controller';

import { TaskDto } from './dto/task.dto';
import { WorkRepository } from './work.repository';

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as child_process from 'child_process';
import { format } from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';
import {
  AndroidPath,
  HostPath,
  sourcesPath,
  workspacePath,
} from 'src/utils/const';

/**
 * WorkController manages work-related operations.
 */
@ApiTags('work')
@Controller()
export class WorkController {
  constructor(
    private readonly adb: AdbController,
    private readonly repository: WorkRepository,
  ) {}

  cache = {};

  /**
   * Returns a greeting message.
   */
  @Get()
  async getHello(): Promise<string> {
    return 'IDS Android Sqllite Performance Council API Server';
  }

  /**
   * Retrieves a list of all works.
   */
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

  /**
   * Retrieves details of a specific work by its ID.
   */
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

  /**
   * Retrieves tasks associated with a specific work by its ID.
   */
  @Get('works/:workId/tasks')
  async getTasks(@Param('workId') workId: string) {
    const workPath = path.resolve(HostPath.Workspace, workId);
    const files = await fs.promises.readdir(workPath, { withFileTypes: true });
    const percents = files
      .filter((file) => file.isDirectory())
      .map((file) => Number(file.name));
    return percents;
  }

  /**
   * Retrieves a specific task by work ID and task ID.
   */
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

  /**
   * Retrieves queries associated with a specific work by its ID.
   */
  @Get('works/:workId/queries')
  async getQueries(@Param('workId') workId: string) {
    const workPath = path.resolve(HostPath.Workspace, workId);
    const tasks = await fs.promises.readdir(workPath);
    const queries = new Set<string>();
    for (const percent of tasks) {
      try {
        const queryPath = path.join(workPath, percent);
        const files = await fs.promises.readdir(queryPath);
        for (const file of files) {
          if (fs.lstatSync(path.join(queryPath, file)).isDirectory()) {
            queries.add(file);
          }
        }
      } catch (err) {}
    }
    return Array.from(queries.values());
  }

  /**
   * Retrieves queries for a work by its ID.
   */
  async getWorkQueries(workId: string) {
    const workPath = path.resolve(HostPath.Workspace, workId);
    const tasks = await fs.promises.readdir(workPath);
    const queries = new Set<string>();
    for (const percent of tasks) {
      try {
        const queryPath = path.join(workPath, percent);
        const files = await fs.promises.readdir(queryPath);
        for (const file of files) {
          if (fs.lstatSync(path.join(queryPath, file)).isDirectory()) {
            queries.add(file);
          }
        }
      } catch (err) {}
    }
    return Array.from(queries.values());
  }

  /**
   * Retrieves external database sizes for a specific work by its ID.
   */
  @Get('works/:workId/external-db-sizes')
  async getExternalDbSizes(@Param('workId') workId: string) {
    const tasks = await this.getTasks(workId);
    const queries = await this.getWorkQueries(workId);

    console.log({ tasks, queries });

    const ret = [];

    for (const task of tasks) {
      const queryRes = {
        task,
        size: (
          await fs.promises.stat(
            path.resolve(workspacePath, workId, `${task}`, 'external.db'),
          )
        ).size,
      };
      ret.push(queryRes);
    }

    return ret.sort((a, b) => Number(a.task) - Number(b.task));
  }

  /**
   * Retrieves Android execution time for a specific work by its ID.
   */
  @Get('works/:workId/android/time')
  async getWorkAndroidTime(@Param('workId') workId: string) {
    const tasks = await this.getTasks(workId);
    const queries = await this.getWorkQueries(workId);

    console.log({ tasks, queries });

    const ret = [];

    for (const task of tasks) {
      const queryRes = {
        task,
      };
      for (const query of queries) {
        queryRes[query] = (
          await this.repository.readAndroidQueryTime(workId, `${task}`, query)
        )?.real;
      }
      ret.push(queryRes);
    }

    return ret.sort((a, b) => Number(a.task) - Number(b.task));
  }

  /**
   * Retrieves host execution time for a specific work by its ID.
   */
  @Get('works/:workId/host/time')
  async getWorkHostTime(@Param('workId') workId: string) {
    const tasks = await this.repository.getTasks(workId);
    const queries = await this.repository.getWorkQueries(workId);

    console.log({ tasks, queries });

    const ret = [];

    for (const task of tasks) {
      const queryRes = {
        task,
      };
      for (const query of queries) {
        queryRes[query] = (
          await this.repository.readHostQueryTime(workId, `${task}`, query)
        )?.real;
      }
      ret.push(queryRes);
    }

    return ret.sort((a, b) => Number(a.task) - Number(b.task));
  }

  /**
   * Retrieves VDBE information for a specific work and query by their IDs.
   */
  @Get('works/:workId/queries/:queryId/vdbe')
  async getVdbe(
    @Param('workId') workId: string,
    @Param('queryId') queryId: string,
  ) {
    try {
      const tasks = await this.repository.getTasks(workId);

      const ret = [];

      for (const task of tasks) {
        const vdbePath = path.resolve(
          workspacePath,
          workId,
          `${task}`,
          queryId,
          'vdbe-profile.json',
        );
        const raw = await fs.promises.readFile(vdbePath, 'utf-8');
        const data = JSON.parse(raw);

        ret.push({
          task,
          ...data,
        });
      }

      return ret.sort((a, b) => Number(a.task) - Number(b.task));
    } catch (err) {
      console.error(`Error reading the VDBe profile file: ${err}`);
      throw new Error(`Could not read the VDBe profile file: ${err}`);
    }
  }

  /**
   * Initiates a work process based on specified percentage intervals.
   */
  @Post('works')
  async doWork(
    @Query('percentageInterval') percentageInterval: number,
    @Query('percentageTo') percentageTo: number,
  ) {
    const workId = format(new Date(), 'yyyyMMdd-HHmmss');
    const queriesPath = path.join(sourcesPath, 'queries');
    const queries = await fs.promises.readdir(queriesPath);

    await this.adb.pushQuery();

    const targetIndex = Math.floor(percentageTo / percentageInterval);

    let currentPercent = await this.adb.getStoragePercentage();

    for (
      let i = Math.floor(currentPercent / percentageInterval);
      i < targetIndex;
      i = Math.floor(currentPercent / percentageInterval) + 1
    ) {
      const targetPercent = i * percentageInterval;
      console.log(`Filling storage to ${targetPercent}% (#${targetIndex})`);
      await this.adb.fillStorage(targetPercent);
      currentPercent = await this.adb.getStoragePercentage();
      const taskId = `${i * percentageInterval}`;
      await this.doTask(workId, taskId, { queries });
    }

    return {
      asdf: 11,
    };
  }

  /**
   * Executes a task based on work ID and task ID.
   */
  @Post('works/:workId/tasks/:taskId')
  async doTask(
    @Param('workId') workId: string,
    @Param('taskId') taskId: string,
    @Body() body: TaskDto,
  ) {
    const queries = body.queries;
    console.log(`Task for ${taskId}%`);

    this.adb.pushQuery();

    await this.exportDB(workId, taskId);

    for (const queryId of queries) {
      await this.doQueryOnAndroid(workId, taskId, queryId);
      await this.doQueryOnHost(workId, taskId, queryId);
    }
  }

  /**
   * Exports the database for a given work and task.
   */
  @Post('works/:workId/tasks/:taskId/export-db')
  async exportDB(
    @Param('workId') workId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.adb.pullFile(
      AndroidPath.ExternalDB,
      path.resolve(workspacePath, workId, taskId, 'external.db'),
    );
  }

  /**
   * Executes a query on Android for a given work, task, and query ID.
   */
  async doQueryOnAndroid(workId: string, taskId: string, queryId: string) {
    console.log(`[Android] Query for ${queryId}`);

    // todo: media query reload

    await this.adb.dropCache();

    const res = await this.adb.shell(
      `((echo -e ".eqp on\\n.scanstats on\\n" ; cat ${AndroidPath.Query}/${queryId}) | time sqlite3 ${AndroidPath.ExternalDB}) 2>&1 | tail -n 1`,
    );

    const times = this.repository.parseAndroidTime(res);

    const androidTimePath = path.resolve(
      workspacePath,
      workId,
      taskId,
      queryId,
      'android-time.json',
    );

    await fs.promises.mkdir(path.dirname(androidTimePath), {
      recursive: true,
    });
    await fs.promises.writeFile(
      androidTimePath,
      JSON.stringify(times),
      'utf-8',
    );
  }

  /**
   * Re-executes host work for a given work ID.
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
        await this.doQueryOnHost(workId, task.name, query);
      }
    }
  }

  /**
   * Executes a query on the host for a given work, task, and query ID.
   */
  async doQueryOnHost(workId: string, taskId: string, queryId: string) {
    console.log(`[Host] Query for ${queryId}`);
    const taskPath = path.resolve(workspacePath, workId, taskId);
    const queryWorkspacePath = path.resolve(taskPath, queryId);
    const sqlitePath = path.resolve(taskPath, 'external.db');
    const queryPath = path.resolve(sourcesPath, 'queries', queryId);
    const hostTimePath = path.resolve(queryWorkspacePath, 'host-time.json');
    await fs.promises.mkdir(queryWorkspacePath, {
      recursive: true,
    });

    const ret = child_process.execSync(
      `cd ${queryWorkspacePath} ; ((echo -e ".eqp on\\n.scanstats on\\n" ; cat ${queryPath}) | time sqlite3 ${sqlitePath}) 2>&1 | tail -n 2`,
      { shell: '/bin/bash' },
    );

    const times = this.repository.parseHostTime(ret.toString());

    await fs.promises.mkdir(path.dirname(hostTimePath), {
      recursive: true,
    });
    await fs.promises.writeFile(hostTimePath, JSON.stringify(times), 'utf-8');

    // vdbe profile 측정
    // await this.parseVdbeProfile(
    //   path.join(queryWorkspacePath, 'vdbe_profile.out'),
    // );

    const vdbeProfileDestPath = path.join(
      queryWorkspacePath,
      'vdbe_profile.out',
    );

    await this.repository.parseVdbeProfile(vdbeProfileDestPath);
  }
}
