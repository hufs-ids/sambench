import * as dotenv from 'dotenv';
import { cleanEnv, port, str, url } from 'envalid';

dotenv.config();

export const env = cleanEnv(process.env, {
  API_PORT: port({ default: 3000 }),
});
