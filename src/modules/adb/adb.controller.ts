import { WorkRepository } from '../work/work.repository';

import {
  Controller,
  Delete,
  Get,
  NotImplementedException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import ADB from 'appium-adb';
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
import { sleep } from 'src/utils/utils';

/**
 * Controller for ADB operations.
 */
@ApiTags('MISC-adb')
@Controller('adb')
export class AdbController {
  adb?: ADB;

  constructor(private readonly repository: WorkRepository) {}

  /**
   * Initializes the ADB module on module start.
   */
  async onModuleInit() {
    this.adb = await ADB.createADB({
      adbExecTimeout: 5 * 60 * 1000,
    });

    await this.adbInitalize();
  }

  @Post('initalize')
  async adbInitalize() {
    await this.adb.root();

    const devices = await this.adb.getConnectedDevices();

    if (devices[0].udid) this.adb.setDeviceId(devices[0].udid);
  }

  /**
   * Executes a shell command on the connected device.
   * @param {string} command The shell command to execute.
   * @returns The result of the shell command.
   */
  @Post('shell')
  async shell(@Query('command') command: string) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    return this.adb.shell(command);
  }

  /**
   * Executes a SQLite query on the connected device.
   * @param {string} sql The SQL query to execute.
   * @returns The result of the SQLite query.
   */
  @Post('sqlite')
  async executeSqliteQuery(@Query('sql') sql: string) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    const fixedQuery = sql.replace(/'/g, '"');

    return this.shell(
      `echo '${fixedQuery}' | sqlite3 ${AndroidPath.ExternalDB}`,
    );
  }

  /**
   * Executes a SQLite query on the connected device.
   * @param {string} sql The SQL query to execute.
   * @returns The result of the SQLite query.
   */
  @Post('sqlite/benchmark')
  async executeSqliteQueryBenchmark(@Query('sql') sql: string) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    // 연결된 기기에서 호스트로 DB 파일을 가져옵니다.
    const dbPathOnDevice = `${AndroidPath.ExternalDB}`;
    const dbPathOnHost = path.resolve(HostPath.Workspace, 'temp.db');
    await this.adb.pull(dbPathOnDevice, dbPathOnHost);
    const vdbeProfilePath = path.resolve(
      HostPath.Workspace,
      'vdbe_profile.out',
    );

    try {
      const fixedQuery = sql.replace(/'/g, '"');

      const androidShellCommand = `(echo '${fixedQuery}' | time sqlite3 ${AndroidPath.ExternalDB}) 2>&1`;
      const androidResult = await this.shell(androidShellCommand);

      // 호스트에서 sqlite3를 실행하여 쿼리를 수행합니다.
      const hostShellCommand = `(cd ${workspacePath} ; echo 3 > /proc/sys/vm/drop_caches ; ((echo -e '.eqp on\\n.scanstats on\\n' ; echo '${fixedQuery}') | time sqlite3 ${dbPathOnHost})) 2>&1`;
      const hostResult = child_process
        .execSync(hostShellCommand, { shell: '/bin/bash' })
        .toString();

      // vdbe.out을 분석합니다.
      const vdbe = await this.repository.parseVdbeProfile(vdbeProfilePath);

      // 결과를 반환합니다.
      return {
        android: {
          shell: androidShellCommand,
          result: androidResult,
        },
        host: {
          shell: hostShellCommand,
          result: hostResult,
          vdbe,
        },
      };
    } finally {
      // 호스트에서 사용한 DB 파일을 삭제합니다.
      fs.unlinkSync(dbPathOnHost);
      fs.unlinkSync(vdbeProfilePath);
    }
  }

  /**
   * Retrieves a list of connected devices.
   * @returns A list of connected devices.
   */
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

  /**
   * Retrieves the selected device ID.
   * @returns The selected device ID.
   */
  @Get('devices/selected')
  async getSelectedDeviceId() {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    return this.adb.curDeviceId;
  }

  /**
   * Selects a device by its device ID.
   * @param {string} deviceId The device ID to select.
   */
  @Post('devices/:deviceId/select')
  async selectDevice(@Param('deviceId') deviceId: string) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    this.adb.setDeviceId(deviceId);
  }

  /**
   * Connects to a device over WiFi.
   */
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

  /**
   * Retrieves the storage percentage used on the device.
   * @returns The storage percentage used.
   */
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

  /**
   * Generates a batch of storage files.
   * @param {number} batches The number of batches to generate.
   * @param {number} imgRatio The ratio of image files.
   * @param {number} xmpRatio The ratio of XMP files.
   * @returns The count of generated files.
   */
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

  /**
   * Copies a batch of images.
   * @param {number} repeat The number of times to repeat the copy operation.
   */
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

  /**
   * Fills the storage to a specified percentage by duplicating a batch folder.
   * @param {number} targetPercent The target storage percentage to fill up to.
   */
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

  /**
   * Drains the storage to a specified percentage by removing images from a cloned batch.
   * @param {number} targetPercent The target storage percentage to drain down to.
   */
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

  /**
   * Adjusts the storage to a specified percentage.
   */
  @Post('storage/adjust')
  async adjustStorage(@Query('targetPercentage') targetPercent: number) {
    const currentPercent = await this.getStoragePercentage();
    const diff = targetPercent - currentPercent;
    if (diff > 0) {
      await this.fillStorage(targetPercent);
    } else if (diff < 0) {
      await this.removeStorage(targetPercent);
    }
  }

  /**
   * Removes images from the device.
   * @param {number} second The time in seconds to allow the removal command to run.
   */
  async removeImages(second = 3) {
    try {
      await this.shell(`timeout ${second} rm -rf /sdcard/DCIM/batch-*`);
    } catch (e) {}
  }

  isMetric = true;

  /**
   * Returns Prometheus formatted metrics.
   * @returns Prometheus formatted metrics.
   */

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

    const externalDbImageCount = await this.getCountOfImages();

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

  /**
   * Toggles the metrics on or off.
   * @param {boolean} isMetric The state to set for metrics.
   */
  @Put('metrics')
  async metricsOn(@Query('isMetric') isMetric: boolean) {
    this.isMetric = isMetric;
  }

  /**
   * Converts the provided data to Prometheus metrics format.
   * @param {object} data The data to convert.
   * @returns Prometheus metrics as a string.
   */
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

  /**
   * Retrieves the size of the external database.
   * @returns The size of the database.
   */
  @Get('external-db/size')
  async getExternalDbSize() {
    const str = await this.shell(`du -b ${AndroidPath.ExternalDB}`);
    const size = str.split('\t')[0];

    return size;
  }

  /**
   * Retrieves the count of pending images in the external database.
   * @returns The count of pending images.
   */
  @Get('external-db/pending-count')
  async getCountOfPending() {
    return await this.executeSqliteQuery(
      `SELECT COUNT(*) FROM images WHERE is_pending = 1;`,
    );
  }

  /**
   * Retrieves the count of images in the external database.
   * @returns The count of images.
   */
  @Get('external-db/image-count')
  async getCountOfImages() {
    return await this.executeSqliteQuery(`SELECT COUNT(*) FROM images;`);
  }

  /**
   * Retrieves the fragmentation level of the external database.
   * @returns The fragmentation level.
   */
  @Get('external-db/fragmentation')
  async getExternalDbFragmentation() {
    const str = await this.shell(
      `f2fs.fibmap ${AndroidPath.ExternalDB} | tail -n +17 | wc -l`,
    );

    return Number(str);
  }

  /**
   * Creates a trigger for the files table in the external database.
   */
  @Post('external-db/trigger')
  async createTrigger() {
    return await this.executeSqliteQuery(
      `CREATE TRIGGER files_update AFTER UPDATE ON files BEGIN SELECT _UPDATE(old.volume_name||':'||old._id||':'||old.media_type||':'||old.is_download||':'||new._id||':'||new.media_type||':'||new.is_download||':'||old.is_trashed||':'||new.is_trashed||':'||old.is_pending||':'||new.is_pending||':'||old.is_favorite||':'||new.is_favorite||':'||ifnull(old._special_format,0)||':'||ifnull(new._special_format,0)||':'||ifnull(old.owner_package_name,'null')||':'||ifnull(new.owner_package_name,'null')||':'||old._data); END;`,
    );
  }

  /**
   * Removes a trigger for the files table in the external database.
   */
  @Delete('external-db/trigger')
  async dropTrigger() {
    return await this.executeSqliteQuery(
      `DROP TRIGGER IF EXISTS files_update;`,
    );
  }

  /**
   * Fragments the external database by updating file records.
   * @param {number} batch The number of updates per batch.
   * @param {number} repeat The number of times to repeat the update batches.
   */

  /*
  @Post('external-db/fragmentate')
  async externalDbFragmentate(
    @Query('batch') batch: number,
    @Query('repeat') repeat: number,
  ) {
    await this.dropTrigger();

    await sleep(1000);

    try {
      for (let i = 0; i < repeat; i++) {
        let query = `BEGIN TRANSACTION;`;

        for (let j = 0; j < batch; j++) {
          query += `UPDATE files SET date_modified = date_modified + 1 WHERE _id = (SELECT _id FROM files ORDER BY RANDOM() LIMIT 1);`;
        }
        query += `COMMIT;`;

        await this.executeSqliteQuery(query);
      }

      // for (let i = 0; i < repeat; i++) {
      //   const query = `BEGIN TRANSACTION;
      //   WITH RECURSIVE counter(n) AS (
      //     SELECT 1
      //     UNION ALL
      //     SELECT n+1 FROM counter LIMIT ${batch}
      //   )
      //   UPDATE files SET date_modified = date_modified + 1
      //   WHERE _id IN (
      //     SELECT _id FROM files ORDER BY RANDOM() LIMIT 1
      //   );
      //   COMMIT;`;

      //   await this.executeSqliteQuery(query);
      // }
    } finally {
      await this.createTrigger();
    }
  }
  */

  @Post('external-db/fragmentate')
  async externalDbFragmentate(
    @Query('batch') batch: number,
    @Query('repeat') repeat: number,
  ) {
    await this.dropTrigger();

    await sleep(1000);

    try {
      for (let i = 0; i < repeat; i++) {
        const queries = [
          `UPDATE local_metadata SET generation = generation;`,

          `UPDATE android_metadata SET locale = locale;`,

          `UPDATE thumbnails SET _data = _data, image_id = image_id, kind = kind, width = width, height = height WHERE _id = _id;`,

          `UPDATE album_art SET _data = _data WHERE album_id = album_id;`,

          `UPDATE videothumbnails SET _data = _data, video_id = video_id, kind = kind, width = width, height = height WHERE _id = _id;`,

          `UPDATE files SET _data = _data, _size = _size, format = format, parent = parent, date_added = date_added, date_modified = date_modified, mime_type = mime_type, title = title, description = description, _display_name = _display_name, picasa_id = picasa_id, orientation = orientation, latitude = latitude, longitude = longitude, datetaken = datetaken, mini_thumb_magic = mini_thumb_magic, bucket_id = bucket_id, bucket_display_name = bucket_display_name, isprivate = isprivate, title_key = title_key, artist_id = artist_id, album_id = album_id, composer = composer, track = track, year = year, is_ringtone = is_ringtone, is_music = is_music, is_alarm = is_alarm, is_notification = is_notification, is_podcast = is_podcast, album_artist = album_artist, duration = duration, bookmark = bookmark, artist = artist, album = album, resolution = resolution, tags = tags, category = category, language = language, mini_thumb_data = mini_thumb_data, name = name, media_type = media_type, old_id = old_id, is_drm = is_drm, width = width, height = height, title_resource_uri = title_resource_uri, owner_package_name = owner_package_name, color_standard = color_standard, color_transfer = color_transfer, color_range = color_range, _hash = _hash, is_pending = is_pending, is_download = is_download, download_uri = download_uri, referer_uri = referer_uri, is_audiobook = is_audiobook, date_expires = date_expires, is_trashed = is_trashed, group_id = group_id, primary_directory = primary_directory, secondary_directory = secondary_directory, document_id = document_id, instance_id = instance_id, original_document_id = original_document_id, relative_path = relative_path, volume_name = volume_name, artist_key = artist_key, album_key = album_key, genre = genre, genre_key = genre_key, genre_id = genre_id, author = author, bitrate = bitrate, capture_framerate = capture_framerate, cd_track_number = cd_track_number, compilation = compilation, disc_number = disc_number, is_favorite = is_favorite, num_tracks = num_tracks, writer = writer, exposure_time = exposure_time, f_number = f_number, iso = iso, scene_capture_type = scene_capture_type, generation_added = generation_added, generation_modified = generation_modified, xmp = xmp, _transcode_status = _transcode_status, _video_codec_type = _video_codec_type, _modifier = _modifier, is_recording = is_recording, redacted_uri_id = redacted_uri_id, _user_id = _user_id, _special_format = _special_format WHERE _id = _id;`,

          `UPDATE sqlite_sequence SET name = name, seq = seq;`,

          `UPDATE log SET time = time, message = message;`,

          `UPDATE deleted_media SET old_id = old_id, generation_modified = generation_modified WHERE _id = _id;`,

          `UPDATE audio_playlists_map SET audio_id = audio_id, playlist_id = playlist_id, play_order = play_order WHERE _id = _id;`,
        ];

        for (let j = 0; j < batch; j++) {
          // Select a random update query from the list for each batch operation
          const randomQuery =
            queries[Math.floor(Math.random() * queries.length)];
          let query = `BEGIN TRANSACTION;`;
          query += randomQuery;
          query += `COMMIT;`;

          await this.executeSqliteQuery(query);
        }
      }
    } finally {
      await this.createTrigger();
    }
  }

  @Post('external-db/pending-count/adjust')
  async adjustPendingCount(@Query('targetPercent') targetPercent: number) {
    await this.executeSqliteQuery(
      `WITH RowCount AS (
        SELECT CAST(COUNT(*) * ${targetPercent} / 100.0 AS INTEGER) AS TargetCount
        FROM files
      ),
      SelectedRows AS (
        SELECT _id
        FROM files, RowCount
        ORDER BY _id
        LIMIT (SELECT TargetCount FROM RowCount)
      )
      UPDATE files
      SET is_pending = CASE WHEN _id IN (SELECT _id FROM SelectedRows) THEN 1 ELSE 0 END;`,
    );
  }

  /**
   * Counts the number of images in the file system's batch directory.
   * @returns The count of images.
   */
  @Get('fs/image-count')
  async fsImageCount() {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    const imageCountInBatch = Number(
      await this.adb.shell('ls -l /sdcard/DCIM/batch | tail -n +2 | wc -l'),
    );

    const batchCount = Number(
      await this.adb.shell(
        'ls -l /sdcard/DCIM | grep "batch-" | tail -n +2 | wc -l',
      ),
    );
    return imageCountInBatch * batchCount;
  }

  /**
   * Drops the cache on the device.
   */
  @Post('drop-cache')
  async dropCache() {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    await this.shell('echo 3 > /proc/sys/vm/drop_caches');
  }

  /**
   * Broadcasts a refresh to the media storage.
   */
  @Post('broadcast-refresh')
  async broadcastRefresh() {
    return await this.shell(
      'am broadcast -a android.intent.action.MEDIA_MOUNTED -d file:///sdcard',
    );
  }

  /**
   * Reboots the device.
   * @returns The result of the reboot operation.
   */
  @Post('reboot')
  async reboot() {
    return await this.adb.reboot();
  }

  /**
   * Pushes a query file to the device.
   */
  @Put('push-query')
  async pushQuery() {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    await this.shell('rm -rf /sdcard/queries');
    await this.pushFile(path.join(sourcesPath, 'queries'), AndroidPath.Query);
  }

  /**
   * Pushes a file from the local system to the remote device.
   * @param {string} localPath - The path of the file on the local system.
   * @param {string} remotePath - The destination path on the remote device.
   * @throws Will throw an error if adb is not initialized.
   */
  async pushFile(localPath: string, remotePath: string) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    await this.adb.push(localPath, remotePath);
  }
  /**
   * Pulls a database file from the remote device to the local system using a temporary file.
   * @param {string} androidPath - The path of the database file on the remote device.
   * @param {string} hostPath - The destination path on the local system.
   * @throws Will throw an error if adb is not initialized.
   */
  @Post('pull-db-file')
  @ApiQuery({
    name: 'androidPath',
    required: true,
    description: 'The path of the database file on the android device.',
    example: AndroidPath.ExternalDB,
  })
  @ApiQuery({
    name: 'hostPath',
    required: true,
    description: 'The destination path on the host system.',
    example: `${HostPath.Workspace}/external.db`,
  })
  async pullFile(
    @Query('androidPath') androidPath: string,
    @Query('hostPath') hostPath: string,
  ) {
    if (!this.adb) {
      throw new Error('adb is not initialized');
    }

    const tmpPath = `/sdcard/tmp-${Math.floor(Math.random() * 10000)}`;
    try {
      console.log('1', hostPath);
      const folder = path.dirname(hostPath);
      console.log('2', folder);
      await fs.promises.mkdir(folder, { recursive: true });
      console.log('3');

      await this.shell(`cp ${androidPath} ${tmpPath}`);
      console.log('4');
      await this.adb.pull(`${tmpPath}`, hostPath);
      console.log('5');
    } catch (e) {
      console.error(e);
      return e;
    } finally {
      await this.shell(`if [ -f ${tmpPath} ]; then rm ${tmpPath}; fi`);
    }
  }

  /**
   * Initiates a factory reset on the remote device.
   * @throws NotImplementedException if the method is not yet implemented.
   */
  @Post('factory-reset')
  async factoryReset() {
    throw new NotImplementedException('아직 구현중입니다.');
    await this.adb.shell('recovery --wipe_data');
  }
}
