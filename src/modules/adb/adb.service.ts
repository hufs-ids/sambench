import { Injectable, OnModuleInit } from '@nestjs/common';
import ADB from 'appium-adb';
import * as path from 'path';

const sourcesPath = path.resolve(process.cwd(), 'sources');
const workspacePath = path.resolve(process.cwd(), 'workspace');

@Injectable()
export class AdbService implements OnModuleInit {
  private adb?: ADB;

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

    const lines = res.split('');
    const lastLine = lines[lines.length - 1];
    const parts = lastLine.split(/\s+/);
    const used = Number(parts[2]);
    const available = Number(parts[3]);
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

    return this.convertToJsonPrometheusMetrics({
      cpu,
      mem,
      disk,
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
`;
  }
}
