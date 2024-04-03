import { Injectable } from '@nestjs/common';
import { parse } from 'csv';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { HostPath } from 'src/utils/const';

@Injectable()
export class WorkRepository {
  async getTasks(workId: string) {
    const workPath = path.resolve(HostPath.Workspace, workId);
    const files = await fs.promises.readdir(workPath, { withFileTypes: true });
    const percents = files
      .filter((file) => file.isDirectory())
      .map((file) => Number(file.name));
    return percents;
  }

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

  async readAndroidQueryTime(workId: string, percent: string, query: string) {
    const queryPath = path.resolve(HostPath.Workspace, workId, percent, query);
    try {
      const data = await this.readJson(
        path.join(queryPath, 'android-time.json'),
      );

      return data;
    } catch (err) {
      return null;
    }
  }

  async readHostQueryTime(workId: string, percent: string, query: string) {
    const queryPath = path.resolve(HostPath.Workspace, workId, percent, query);
    try {
      const data = await this.readJson(path.join(queryPath, 'host-time.json'));

      return data;
    } catch (err) {
      return null;
    }
  }

  async readJson(path: string) {
    const raw = await fs.readFileSync(path, 'utf-8');

    return JSON.parse(raw);
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

  async parseVdbeProfile(vdbePath: string) {
    const queryWorkspacePath = path.resolve(vdbePath, '..');
    const stream = fs.createReadStream(vdbePath, 'utf-8');
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    const result = {};

    for await (const line of rl) {
      if (line.charAt(0) === '-') continue; // 주석 라인은 건너뛴다

      const splited = line.split(/ +/g).filter((t) => !!t);
      if (!splited[4]) continue; // 키가 없는 라인은 건너뛴다

      const key = splited[4];
      const value = Number(splited[1]);

      if (!isNaN(value)) {
        // 유효한 숫자인 경우에만 처리
        if (result[key]) {
          result[key] += value;
        } else {
          result[key] = value;
        }
      }
    }

    // 결과를 JSON 파일로 저장
    await fs.promises.writeFile(
      path.join(queryWorkspacePath, 'vdbe-profile.json'),
      JSON.stringify(result),
      'utf-8',
    );

    return result;
  }
}
