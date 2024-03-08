import {
  Controller,
  Delete,
  Get,
  NotImplementedException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import ADB from 'appium-adb';
import { format } from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';
import { AndroidPath, sourcesPath } from 'src/utils/const';
import { sleep } from 'src/utils/utils';

@ApiTags('adb')
@Controller('adb')
export class AdbController {
  adb?: ADB;

  async onModuleInit() {
    this.adb = await ADB.createADB({
      adbExecTimeout: 5 * 60 * 1000,
    });

    await this.adb.root();

    const devices = await this.adb.getConnectedDevices();

    this.adb.setDeviceId(devices[0].udid);
  }

  async shell(command: string) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    return this.adb.shell(command);
  }

  async executeSqliteQuery(query: string) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    const fixedQuery = query.replace(/'/g, '"');

    return this.shell(
      `echo '${fixedQuery}' | sqlite3 ${AndroidPath.ExternalDB}`,
    );
  }

  @Get('devices')
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

  @Get('devices/selected')
  async getSelectedDeviceId() {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    return this.adb.curDeviceId;
  }

  @Post('devices/:deviceId/select')
  async selectDevice(@Param('deviceId') deviceId: string) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    this.adb.setDeviceId(deviceId);
  }

  @Post('device/connect-over-wifi')
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

  @Get('storage/percentage')
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

  @Post('storage/generate-batch')
  async generateStorageBatch(
    @Query('batches') batches: number,
    @Query('imgRatio') imgRatio: number,
    @Query('xmpRatio') xmpRatio: number,
  ) {
    const ratioSum = imgRatio + xmpRatio;

    const sources = ['img.jpeg', 'xmp.jpeg'];

    const sourcesRatio = [imgRatio, xmpRatio];

    const sourceCounts: { [key in string]: number } = {};

    sources.forEach((source, i) => {
      sourceCounts[source] = Math.round((sourcesRatio[i] / ratioSum) * batches);
    });

    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    await this.shell('mkdir -p /sdcard/DCIM');

    for (const source of sources) {
      console.log('push', source);
      await this.adb.push(
        path.resolve(sourcesPath, source),
        `/sdcard/DCIM/${source}`,
      );
      await sleep(1000);
    }

    await this.shell('rm -rf /sdcard/DCIM/batch');
    await this.shell('mkdir -p /sdcard/DCIM/batch');

    for (const source in sourceCounts) {
      const count = sourceCounts[source];
      for (let i = 0; i < count; i++) {
        const indexString = i.toString().padStart(3, '0');
        await this.shell(
          `cp /sdcard/DCIM/${source} /sdcard/DCIM/batch/${indexString}-${source}`,
        );
      }
    }
    return {
      count: sourceCounts,
    };
  }

  async copyBatchOfImages(repeat = 10) {
    for (let i = 0; i < repeat; i++) {
      const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
      await this.shell(
        [
          `mkdir -p /sdcard/DCIM/batch-${timestamp}`,
          `sleep 1`,
          `cp -r /sdcard/DCIM/batch/. /sdcard/DCIM/batch-${timestamp}`,
        ].join(' && '),
      );
    }
  }

  @Post('storage/fill')
  async fillStorage(@Query('targetPercentage') targetPercent: number) {
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

  @Post('storage/drain')
  async removeStorage(@Query('targetPercentage') targetPercent: number) {
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

  async removeImages(second = 3) {
    try {
      await this.shell(`timeout ${second} rm -rf /sdcard/DCIM/batch-*`);
    } catch (e) {}
  }

  isMetric = true;

  @Patch('metrics/on')
  async metricsOn() {
    this.isMetric = true;
  }

  @Patch('metrics/off')
  async metricsOff() {
    this.isMetric = false;
  }

  @Get('metrics')
  async getMetrics() {
    if (!this.isMetric) return;
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

    const externalDbImageCount = await this.getExternalDbImageCount();

    const externalDbSize = await this.getExternalDbSize();

    const externalDbFragmentation = await this.getExternalDbFragmentation();

    const fsImageCount = await this.fsImageCount();

    return this.convertToJsonPrometheusMetrics({
      cpu,
      mem,
      disk,
      pendingCount,
      externalDbImageCount,
      externalDbSize,
      externalDbFragmentation,
      fsImageCount,
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

# HELP pending_count pending_count
# TYPE pending_count gauge
pending_count ${data.pendingCount}

# HELP externaldb_image_count externaldb_image_count
# TYPE externaldb_image_count gauge
externaldb_image_count ${data.externalDbImageCount}

# HELP external_db_size external_db_size
# TYPE external_db_size gauge
external_db_size ${data.externalDbSize}

# HELP external_db_fragmentation external_db_fragmentation
# TYPE external_db_fragmentation gauge
external_db_fragmentation ${data.externalDbFragmentation}

# HELP fs_image_count fs_image_count
# TYPE fs_image_count gauge
fs_image_count ${data.fsImageCount}
`;
  }

  async getExternalDbImageCount() {
    return await this.shell(
      `echo "SELECT COUNT(*) FROM images;" | sqlite3 ${AndroidPath.ExternalDB}`,
    );
  }

  async getExternalDbSize() {
    const str = await this.shell(`ls -l ${AndroidPath.ExternalDB}`);
    const size = str.split(' ')[4];

    return Number(size);
  }

  @Get('external-db/pending-count')
  async getCountOfPending() {
    return await this.executeSqliteQuery(
      `SELECT COUNT(*) FROM images WHERE is_pending = 1;`,
    );
  }

  @Get('external-db/image-count')
  async getCountOfImages() {
    return await this.shell(
      `echo "SELECT COUNT(*) FROM images;" | sqlite3 ${AndroidPath.ExternalDB}`,
    );
  }

  @Get('external-db/fragmentation')
  async getExternalDbFragmentation() {
    const str = await this.shell(
      `f2fs.fibmap ${AndroidPath.ExternalDB} | tail -n +17 | wc -l`,
    );

    return Number(str);
  }

  /**
   * files 테이블에 대한 트리거를 복구합니다.
   */
  @Post('external-db/trigger')
  async createTrigger() {
    return await this.executeSqliteQuery(
      `CREATE TRIGGER files_update AFTER UPDATE ON files BEGIN SELECT _UPDATE(old.volume_name||':'||old._id||':'||old.media_type||':'||old.is_download||':'||new._id||':'||new.media_type||':'||new.is_download||':'||old.is_trashed||':'||new.is_trashed||':'||old.is_pending||':'||new.is_pending||':'||old.is_favorite||':'||new.is_favorite||':'||ifnull(old._special_format,0)||':'||ifnull(new._special_format,0)||':'||ifnull(old.owner_package_name,'null')||':'||ifnull(new.owner_package_name,'null')||':'||old._data); END;`,
    );
  }

  /**
   * files 테이블에 대한 트리거를 제거합니다.
   */
  @Delete('external-db/trigger')
  async dropTrigger() {
    return await this.executeSqliteQuery(
      `DROP TRIGGER IF EXISTS files_update;`,
    );
  }

  @Post('external-db/fragmentate')
  async externalDbFragmentate() {
    await this.dropTrigger();

    try {
      for (let i = 0; i < 100; i++) {
        let query = `BEGIN TRANSACTION;`;

        for (let j = 0; j < 10; j++) {
          query += `UPDATE files SET date_modified = date_modified + 1 WHERE _id = (SELECT _id FROM files ORDER BY RANDOM() LIMIT 1);`;
        }
        query += `COMMIT;`;

        await this.executeSqliteQuery(query);
      }
    } finally {
      await this.createTrigger();
    }
  }

  @Get('fs/image-count')
  async fsImageCount() {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    const imageCountInBatch = Number(
      await this.adb.shell('ls -l /sdcard/DCIM/batch | wc -l'),
    );

    const batchCount = Number(
      await this.adb.shell(
        'ls -l /sdcard/DCIM | grep "batch-" | tail -n +2 | wc -l',
      ),
    );
    return imageCountInBatch * batchCount;
  }

  @Post('force-pending-to-0')
  async forcePendingTo0() {
    return await this.shell(
      `echo "UPDATE files SET is_pending = 0 WHERE is_pending = 1;" | sqlite3 ${AndroidPath.ExternalDB}`,
    );
  }

  @Post('drop-cache')
  async dropCache() {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    await this.shell('echo 3 > /proc/sys/vm/drop_caches');
  }

  @Post('broadcast-refresh')
  async broadcastRefresh() {
    return await this.shell(
      'am broadcast -a android.intent.action.MEDIA_MOUNTED -d file:///sdcard',
    );
  }

  @Post('reboot')
  async reboot() {
    return await this.adb.reboot();
  }

  @Put('push-query')
  async pushQuery() {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    await this.shell('rm -rf /sdcard/queries');
    await this.pushFile(path.join(sourcesPath, 'queries'), AndroidPath.Query);
  }

  async pushFile(localPath: string, remotePath: string) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    await this.adb.push(localPath, remotePath);
  }

  async pullDbFileSu(remotePath: string, localPath: string) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    const tmpPath = `/sdcard/tmp-${Math.floor(Math.random() * 10000)}.db`;
    try {
      const folder = path.dirname(localPath);
      await fs.promises.mkdir(folder, { recursive: true });

      await this.shell(`cp ${remotePath} ${tmpPath}`);
      // await this.shell(`sqlite3 ${remotePath} ".clone ${tmpPath}"`);
      await this.adb.pull(`${tmpPath}`, localPath);
    } finally {
      await this.shell(`rm ${tmpPath}`);
    }
  }

  @Post('factory-reset')
  async factoryReset() {
    throw new NotImplementedException('아직 구현중입니다.');
    await this.adb.shell('recovery --wipe_data');
  }
}
