import { ConsoleLogger } from '@nestjs/common';

export class AppLogger extends ConsoleLogger {
  reportHttpException(
    method: string,
    status: number,
    route?: string,
    exceptionType?: string,
    errorCode?: string,
  ): void {
    this.error(
      JSON.stringify({
        event: 'http_exception',
        method,
        route,
        status,
        exceptionType,
        errorCode,
      }),
    );
  }
}
