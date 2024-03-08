import * as path from 'path';
export const AndroidPath = {
  Query: '/sdcard/queries',
  ExternalDB:
    '/data/user/0/com.android.providers.media.module/databases/external.db',
};

export const HostPath = {
  Source: path.resolve(process.cwd(), 'sources'),
  Query: path.resolve(process.cwd(), 'sources', 'queries'),
  Workspace: '/home/ids/ssd/workspace',
};
export const sourcesPath = path.resolve(process.cwd(), 'sources');
export const workspacePath = '/home/ids/ssd/workspace';
