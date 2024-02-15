import * as path from 'path';
export const AndroidPath = {
  Query: '/sdcard/queries',
  ExternalDB:
    '/data/user/0/com.android.providers.media.module/databases/external.db',
};
export const sourcesPath = path.resolve(process.cwd(), 'sources');
export const workspacePath = path.resolve(process.cwd(), 'workspace');
