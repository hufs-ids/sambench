import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class MyLogger implements LoggerService {
  debug(message: any, context?: string, ...optionalParams: any[]) {
    console.debug('[Nest]', message)
  }

  error(
    message: any,
    trace?: string,
    context?: string,
    ...optionalParams: any[]
  ) {
    console.error('[Nest]', message)
    console.trace(trace)
  }

  log(message: any, context?: string, ...optionalParams: any[]) {
    if (context === 'NestFactory') return;
    if (context === 'InstanceLoader') return;
    if (context === 'RoutesResolver') return;
    if (context === 'RouterExplorer') return;
    if (context === 'NestMicroservice') return;

    console.log('[Nest]', message)
  }

  warn(message: any, context?: string, ...optionalParams: any[]) {
    console.warn('[Nest]', message)
  }

  verbose(message: any, context?: string, ...optionalParams: any[]) {
    console.log('[Nest]', message)
  }
}
