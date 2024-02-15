import { AndroidPath, sourcesPath } from '../../utils/const';

import { Injectable, OnModuleInit } from '@nestjs/common';
import ADB from 'appium-adb';
import { format } from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AdbService implements OnModuleInit {
  adb?: ADB;

  async onModuleInit() {
    this.adb = await ADB.createADB({});

    const devices = await this.adb.getConnectedDevices();

    this.adb.setDeviceId(devices[0].udid);
  }

  async getDevices() {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    const devices = await this.adb.getDevicesWithRetry();
    return devices.map((device) => ({
      ...device,
      selected: device.udid === this.adb?.curDeviceId,
    }));
  }

  async getSelectedDeviceId() {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    return this.adb.curDeviceId;
  }

  async selectDevice(deviceId: string) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    this.adb.setDeviceId(deviceId);
  }

  async connectOverWifi() {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    const ipRoute = await this.adb.shell('ip route');
    const ipSplits = ipRoute.split(' ');
    const ip = ipSplits[ipSplits.length - 1];
    await this.adb.adbExec(['tcpip', '5555']);
    await this.adb.adbExec(['connect', `${ip}:5555`]);
    await this.selectDevice(`${ip}:5555`);
  }

  async getStoragePercentage() {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    const res = await this.adb.shell('df /storage/emulated/0');

    const splited = res.split(/ +/g).filter((t) => t.length > 0);

    const used = Number(splited[8]);
    const available = Number(splited[9]);
    return (used / (used + available)) * 100;
  }

  async generateStorageBatch(batches = 100) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    const localPath = path.resolve(sourcesPath, 'img.jpeg');
    await this.adb.push(localPath, '/storage/emulated/0/DCIM/source.jpeg');

    await this.adb.shell('rm -rf /storage/emulated/0/DCIM/batch');
    await this.adb.shell('mkdir -p /storage/emulated/0/DCIM/batch');
    let i = 0;
    for (; i < batches; i++) {
      await this.adb.shell(
        `cp /storage/emulated/0/DCIM/source.jpeg /storage/emulated/0/DCIM/batch/${i}.jpeg`,
      );
    }

    return i;
  }

  async pushFile(localPath: string, remotePath: string) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    await this.adb.push(localPath, remotePath);
  }

  async pullFile(remotePath: string, localPath: string) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    await this.adb.pull(remotePath, localPath);
  }

  async pullFileSu(remotePath: string, localPath: string) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    const folder = path.dirname(localPath);
    await fs.promises.mkdir(folder, { recursive: true });

    const tmpPath = `/sdcard/tmp-${Math.floor(Math.random() * 10000)}.db`;
    await this.shellSu(`sqlite3 ${remotePath} ".clone ${tmpPath}"`);
    await this.adb.pull(`${tmpPath}`, localPath);
    await this.shellSu(`rm ${tmpPath}`);
  }

  async shell(command: string) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    return this.adb.shell(command);
  }

  async shellSu(command: string) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    return await this.adb.shell(`echo '${command}' | su`);
  }

  async dropCache() {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    await this.shellSu('echo 3 > /proc/sys/vm/drop_caches');
  }

  async getMetrics() {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    const cpuRaw = await this.adb.shell('dumpsys cpuinfo');
    const cpu = Number(cpuRaw.slice(0, 10).split(' ')[1]);

    const memRaw = await this.adb.shell('free');
    const memSplit = memRaw.split('\n')[1].replace(/ +/g, ' ').split(' ');
    const [, total, used, free, shared, buff] = memSplit;
    const mem = {
      total: Number(total),
      used: Number(used),
      free: Number(free),
      shared: Number(shared),
      buff: Number(buff),
    };

    const diskRaw = await this.adb.shell('df /storage/emulated/0');
    const lines = diskRaw.split('\n');
    const lastLine = lines[lines.length - 1];
    const parts = lastLine.split(/\s+/);
    const disk: any = {
      used: Number(parts[2]),
      available: Number(parts[3]),
    };
    disk.percent = (disk.used / (disk.used + disk.available)) * 100;

    const pendingCount = await this.getCountOfPending();

    return this.convertToJsonPrometheusMetrics({
      cpu,
      mem,
      disk,
      pendingCount,
    });
  }

  convertToJsonPrometheusMetrics(data) {
    return `# HELP cpu_usage CPU 사용량
# TYPE cpu_usage gauge
cpu_usage ${data.cpu}

# HELP mem_total 전체 메모리
# TYPE mem_total gauge
mem_total ${data.mem.total}

# HELP mem_used 사용 중인 메모리
# TYPE mem_used gauge
mem_used ${data.mem.used}

# HELP mem_free 사용 가능한 메모리
# TYPE mem_free gauge
mem_free ${data.mem.free}

# HELP disk_used 사용 중인 디스크 공간
# TYPE disk_used gauge
disk_used ${data.disk.used}

# HELP disk_available 사용 가능한 디스크 공간
# TYPE disk_available gauge
disk_available ${data.disk.available}

# HELP disk_usage_percent 디스크 사용률
# TYPE disk_usage_percent gauge
disk_usage_percent ${data.disk.percent}

# HELP pending_count 디스크 사용률
# TYPE pending_count gauge
pending_count ${data.pendingCount}
`;
  }

  async copyBatchOfImages(repeat = 10) {
    for (let i = 0; i < repeat; i++) {
      const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
      await this.adb.shell(
        `mkdir -p /storage/emulated/0/DCIM/batch-${timestamp}`,
      );
      await this.adb.shell(
        `cp -r /storage/emulated/0/DCIM/batch/. /storage/emulated/0/DCIM/batch-${timestamp}/`,
      );
    }
  }

  async removeImages(second = 3) {
    try {
      await this.adb.shell(
        `timeout ${second} rm -rf /storage/emulated/0/DCIM/batch-*`,
      );
    } catch (e) {}
  }

  async fillStorage(targetPercent: number) {
    let currentPercent = await this.getStoragePercentage();
    let diff = targetPercent - currentPercent;
    let unchangedCount = 0;

    while (diff > 0) {
      await this.copyBatchOfImages();
      const newPercent = await this.getStoragePercentage();
      console.log('[Fill Storage]', 'newPercent', newPercent);
      if (newPercent === currentPercent) {
        unchangedCount++;
        if (unchangedCount >= 10) {
          throw new Error('스토리지 증가가 10번 연속으로 확인되지 않았습니다.');
        }
      } else {
        unchangedCount = 0;
      }
      currentPercent = newPercent;
      diff = targetPercent - currentPercent;
    }
  }

  async drainStorage(targetPercent: number) {
    let currentPercent = await this.getStoragePercentage();
    let diff = currentPercent - targetPercent;
    let unchangedCount = 0;

    while (diff > 0) {
      await this.removeImages(3);
      const newPercent = await this.getStoragePercentage();
      console.log('[Drain Storage]', 'newPercent', newPercent);
      if (newPercent === currentPercent) {
        unchangedCount++;
        if (unchangedCount >= 10) {
          throw new Error('스토리지 감소가 10번 연속으로 확인되지 않았습니다.');
        }
      } else {
        unchangedCount = 0;
      }
      currentPercent = newPercent;
      diff = currentPercent - targetPercent;
    }
  }

  async getCountOfPending() {
    return await this.shellSu(
      `echo "SELECT COUNT(*) FROM images WHERE is_pending = 1;" | sqlite3 ${AndroidPath.ExternalDB}`,
    );
  }
}
