import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
const workspacePath = path.resolve(process.cwd(), 'workspace');

import { WorkRepository } from './work.repository';

import { parse } from 'csv';

@Injectable()
export class WorkService {
  constructor(private readonly repository: WorkRepository) {}
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
    const percents = await this.repository.getWorkPercents(workId);
    const queries = await this.repository.getWorkQueries(workId);

    const ret = [];

    for (const percent of percents) {
      const queryRes = {
        percent,
      };
      for (const query of queries) {
        queryRes[query] = (
          await this.repository.readAndroidQueryTime(
            workId,
            `${percent}`,
            query,
          )
        )?.['Real Time'];
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
}
