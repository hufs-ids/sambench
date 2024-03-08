import { AdbController } from '../adb/adb.controller';

import { WorkRepository } from './work.repository';

import { Injectable } from '@nestjs/common';
import * as child_process from 'child_process';
import { format } from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';
import { AndroidPath, sourcesPath, workspacePath } from 'src/utils/const';

@Injectable()
export class WorkService {
  constructor(
    private readonly repository: WorkRepository,
    private readonly adb: AdbController,
  ) {}
  getHello(): string {
    return 'Hello World!';
  }

  cache = {};

  async getWorkAndroidTime(workId: string): Promise<any> {
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
          await this.repository.readAndroidQueryTime(workId, `${task}`, query)
        )?.real;
      }
      ret.push(queryRes);
    }

    return ret.sort((a, b) => Number(a.task) - Number(b.task));
  }

  async getWorkHostTime(workId: string): Promise<any> {
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

  async getVdbeProfile({
    workId,
    queryId,
  }: {
    workId: string;
    queryId: string;
  }) {
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

  async getQueries(workId: string) {
    return await this.repository.getWorkQueries(workId);
  }

  async getExternalDbSizes(workId: string) {
    const tasks = await this.repository.getTasks(workId);
    const queries = await this.repository.getWorkQueries(workId);

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

  async parseVdbeProfile(vdbePath: string) {
    const queryWorkspacePath = path.resolve(vdbePath, '..');
    try {
      const data = await fs.promises.readFile(vdbePath, 'utf-8');
      const ret = data
        .split('\n')
        .filter((t) => t.charAt(0) !== '-')
        .map((t) => {
          // key = splited[4]
          // index = splited[3]
          // value = int(splited[1])

          const splited = t.split(/ +/g).filter((t) => !!t);

          return {
            key: splited[4],
            value: Number(splited[1]),
          };
        })
        .reduce((acc, cur) => {
          if (!cur.key) return acc;

          if (acc[cur.key]) {
            acc[cur.key] += cur.value;
          } else {
            acc[cur.key] = cur.value;
          }
          return acc;
        }, {});

      fs.promises.writeFile(
        path.join(queryWorkspacePath, 'vdbe-profile.json'),
        JSON.stringify(ret),
        'utf-8',
      );
    } catch (err) {
      console.error(`Error reading the VDBe profile file: ${err}`);
      throw new Error(`Could not read the VDBe profile file at ${vdbePath}`);
    }
  }

  async doWork({
    percentageInterval,
    percentageTo,
  }: {
    percentageInterval: number;
    percentageTo: number;
  }) {
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
      await this.doTask({ workId, taskId, queries });
    }

    return {
      asdf: 11,
    };
  }

  async exportDB({ workId, taskId }: { workId: string; taskId: string }) {
    await this.adb.pullDbFileSu(
      AndroidPath.ExternalDB,
      path.resolve(workspacePath, workId, taskId, 'external.db'),
    );
  }

  async doTask({
    workId,
    taskId,
    queries,
  }: {
    workId: string;
    taskId: string;
    queries: string[];
  }) {
    console.log(`Task for ${taskId}%`);

    this.adb.pushQuery();

    await this.exportDB({ workId, taskId });

    for (const queryId of queries) {
      await this.doQueryOnAndroid(workId, taskId, queryId);
      await this.doQueryOnHost(workId, taskId, queryId);
    }
  }

  async doQueryOnAndroid(workId: string, taskId: string, queryId: string) {
    console.log(`[Android] Query for ${queryId}`);

    // todo: media query reload

    await this.adb.dropCache();

    const res = await this.adb.shellSu(
      `((echo -e ".eqp on\\n.scanstats on\\n" ; cat ${AndroidPath.Query}/${queryId}) | time sqlite3 ${AndroidPath.ExternalDB}) 2>&1 | tail -n 1`,
    );

    const times = this.parseAndroidTime(res);

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
  parseAndroidTime(timeStr: string) {
    const [realStr, , userStr, , systemStr] = timeStr
      .split(/ +/g)
      .filter((t) => t.length > 0);

    const real = this.parseAndroidEachTime(realStr);
    const user = this.parseAndroidEachTime(userStr);
    const system = this.parseAndroidEachTime(systemStr);
    const io = real - user - system;

    return { real, user, system, io };
  }
  /**
   * 0m00.22s 를 초단위 number로 반환하는 함수
   */
  parseAndroidEachTime(time: string): number {
    const [minutes, seconds] = time.split('m').map(parseFloat);
    return minutes * 60 + seconds;
  }

  /**
   * 0.46user 0.01system 0:00.47elapsed 99%CPU
   * 위 형식의 문자열을 분석하여 각 시간을 추출하는 함수
   */
  parseHostTime(timeStr: string) {
    console.log('timeStr', timeStr);
    const [userStr, systemStr, elapsedStr] = timeStr
      .split('\n')[0]
      .split(/ +/g)
      .filter((t) => t.length > 0);

    console.log(userStr, systemStr, elapsedStr);

    const user = parseFloat(userStr.replace('user', ''));
    const system = parseFloat(systemStr.replace('system', ''));
    const real = parseFloat(elapsedStr.split(':')[1].replace('elapsed', ''));
    const io = real - user - system;

    return { real, user, system, io };
  }
  //
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

    const times = this.parseHostTime(ret.toString());

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

    await this.parseVdbeProfile(vdbeProfileDestPath);
  }
}
