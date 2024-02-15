import { AdbService } from '../adb/adb.service';

import { WorkRepository } from './work.repository';

import { Injectable } from '@nestjs/common';
import * as child_process from 'child_process';
import { parse } from 'csv';
import { format } from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';
import { AndroidPath, sourcesPath, workspacePath } from 'src/utils/const';

@Injectable()
export class WorkService {
  constructor(
    private readonly repository: WorkRepository,
    private readonly adb: AdbService,
  ) {}
  getHello(): string {
    return 'Hello World!';
  }

  cache = {};

  async getWorks(): Promise<string[]> {
    const files = await fs.promises.readdir(workspacePath, {
      withFileTypes: true,
    });
    const folders = files
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
    return folders;
  }

  async getWork(workId: string): Promise<any> {
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

    return ret;
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

    return ret;
  }

  async getTask(workId: string, taskId: string): Promise<any> {
    const taskPath = path.resolve(workspacePath, workId, taskId);
    const files = await fs.promises.readdir(taskPath);
    const fileObj = {};
    for (const file of files) {
      const stats = await fs.promises.stat(path.join(taskPath, file));
      if (stats.isDirectory()) {
        fileObj[file] = await this.getQueries(workId, taskId, file);
      }
    }
    return fileObj;
  }

  async getQueries(workId: string, taskId: string, queryId: string) {
    return {
      queryId,
      host: {
        vdbeProfile: await this.readHostVdbeProfile(workId, taskId, queryId),
      },
      android: {
        time: await this.readAndroidQueryTime(workId, taskId, queryId),
      },
    };
  }

  async readAndroidQueryTime(workId: string, taskId: string, queryId: string) {
    const queryPath = path.resolve(workspacePath, workId, taskId, queryId);
    try {
      // CSV 파일 읽기
      const data = await fs.readFileSync(
        path.join(queryPath, 'time.csv'),
        'utf-8',
      );

      // 데이터를 파싱하는 Promise를 반환
      return new Promise((resolve, reject) => {
        const records = [];
        parse(data, {
          columns: true,
          skip_empty_lines: true,
        })
          .on('readable', function () {
            let record;
            while ((record = this.read())) {
              records.push(record);
            }
          })
          .on('end', () => {
            resolve(records);
          })
          .on('error', reject);
      });
    } catch (err) {
      console.error(err);
      throw err; // 오류를 다시 throw하여 호출자에게 전달
    }
  }

  async readHostVdbeProfile(workId: string, taskId: string, queryId: string) {
    const queryPath = path.resolve(workspacePath, workId, taskId, queryId);
    try {
      // CSV 파일 읽기
      const data = await fs.readFileSync(
        path.join(queryPath, 'vdbe_profile.csv'),
        'utf-8',
      );

      this.parseCsv(data);

      // 데이터를 파싱하는 Promise를 반환
      return new Promise((resolve, reject) => {
        const records = [];
        parse(data, {
          columns: true,
          skip_empty_lines: true,
        })
          .on('readable', function () {
            let record;
            while ((record = this.read())) {
              records.push(record);
            }
          })
          .on('end', () => {
            resolve(
              records.reduce((acc, cur) => {
                acc[cur.key] = cur.value;
                return acc;
              }, {}),
            );
          })
          .on('error', reject);
      });
    } catch (err) {
      console.error(err);
      throw err; // 오류를 다시 throw하여 호출자에게 전달
    }
  }

  async parseCsv(data: string) {
    return new Promise((resolve, reject) => {
      const records = [];
      parse(data, {
        columns: true,
        skip_empty_lines: true,
      })
        .on('readable', function () {
          let record;
          while ((record = this.read())) {
            records.push(record);
          }
        })
        .on('end', () => {
          resolve(
            records.reduce((acc, cur) => {
              acc[cur.key] = cur.value;
              return acc;
            }, {}),
          );
        })
        .on('error', reject);
    });
  }

  async getVdbeProfile({
    workId,
    taskId,
    queryId,
  }: {
    workId: string;
    taskId: string;
    queryId: string;
  }) {
    const queryPath = path.resolve(workspacePath, workId, taskId, queryId);
    const vdbeProfilePath = path.join(queryPath, 'vdbe_profile.out');
    try {
      const data = await fs.promises.readFile(vdbeProfilePath, 'utf-8');
      return data
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
          if (acc[cur.key]) {
            acc[cur.key] += cur.value;
          } else {
            acc[cur.key] = cur.value;
          }
          return acc;
        }, {});
    } catch (err) {
      console.error(`Error reading the VDBe profile file: ${err}`);
      throw new Error(
        `Could not read the VDBe profile file at ${vdbeProfilePath}`,
      );
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

    await this.adb.shellSu('rm -rf /sdcard/queries');
    await this.adb.pushFile(path.join(queriesPath), AndroidPath.Query);

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
    await this.adb.pullFileSu(
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
    // todo: media query reload
    // todo: cache 비우기

    // host에 external storage 복사

    await this.exportDB({ workId, taskId });

    for (const queryId of queries) {
      await this.doQueryOnAndroid(workId, taskId, queryId);
      await this.doQueryOnHost(workId, taskId, queryId);
    }
  }

  async doQueryOnAndroid(workId: string, taskId: string, queryId: string) {
    console.log(`[Android] Query for ${queryId}`);

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
    const sqlitePath = path.resolve(
      workspacePath,
      workId,
      taskId,
      'external.db',
    );
    const queryPath = path.resolve(sourcesPath, 'queries', queryId);
    const ret = child_process.execSync(
      `((echo -e ".eqp on\\n.scanstats on\\n" ; cat ${queryPath}) | time sqlite3 ${sqlitePath}) 2>&1 | tail -n 2`,
      { shell: '/bin/bash' },
    );

    const times = this.parseHostTime(ret.toString());

    const hostTimePath = path.resolve(
      workspacePath,
      workId,
      taskId,
      queryId,
      'host-time.json',
    );

    await fs.promises.mkdir(path.dirname(hostTimePath), {
      recursive: true,
    });
    await fs.promises.writeFile(hostTimePath, JSON.stringify(times), 'utf-8');

    // todo: vdbe profile 측정
  }
}
