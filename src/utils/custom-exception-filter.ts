import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch(Error)
export class CustomExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CustomExceptionFilter.name);
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    // Prisma 오류에 대한 처리
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception.message;
    this.logger.error(exception);

    // 응답을 반환
    response.status(status).send(exception.message + '\n\n' + exception.stack);
  }
}
