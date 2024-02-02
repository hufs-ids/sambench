import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
const workspacePath = path.resolve(process.cwd(), 'workspace');

import { parse } from 'csv';

@Injectable()
export class WorkRepository {
  async getWorkPercents(workId: string) {
    const workPath = path.resolve(workspacePath, workId);
    const files = await fs.promises.readdir(workPath, { withFileTypes: true });
    const percents = files
      .filter((file) => file.isDirectory())
      .map((file) => Number(file.name));
    return percents;
  }

  async getWorkQueries(workId: string) {
    const workPath = path.resolve(workspacePath, workId);
    const percents = await fs.promises.readdir(workPath);
    const queries = new Set<string>();
    for (const percent of percents) {
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

  async readAndroidQueryTime(workId: string, percent: string, query: string) {
    const queryPath = path.resolve(workspacePath, workId, percent, query);
    try {
      // CSV 파일 읽기
      const data = await fs.readFileSync(
        path.join(queryPath, 'time.csv'),
        'utf-8',
      );

      // 데이터를 파싱하는 Promise를 반환
      const res = (await this.parseCsv(data))[0];

      Object.keys(res).forEach((key) => {
        res[key] = Number(res[key]);
      });

      return res;
    } catch (err) {
      return null;
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
          resolve(records);
        })
        .on('error', reject);
    });
  }
}
