import { ConsoleLogger } from '@nestjs/common';

export class AppLogger extends ConsoleLogger {
  reportHttpException(method: string, status: number): void {
    this.error(
      JSON.stringify({
        event: 'http_exception',
        method,
        status,
      }),
    );
  }
}
