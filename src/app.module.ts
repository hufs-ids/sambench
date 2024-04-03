import { LoggerMiddleware } from './middleware/logger.middleware';
import { AdbModule } from './modules/adb/adb.module';
import { HostModule } from './modules/host/host.module';
import { PublicModule } from './modules/public/public.module';
import { WorkModule } from './modules/work/work.module';

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

@Module({
  imports: [PublicModule, AdbModule, HostModule, WorkModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
