/**
 * Logging Utility
 * Simple logging with context
 */

export interface LogContext {
  phone?: string;
  state?: string;
  userId?: string;
  [key: string]: any;
}

class Logger {
  private context: LogContext = {};

  setContext(context: LogContext): void {
    this.context = { ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  private formatLog(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = this.context.phone ? ` [${this.context.phone}]` : '';
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] ${level}${contextStr}: ${message}${dataStr}`;
  }

  info(message: string, data?: any): void {
    console.log(this.formatLog('INFO', message, data));
  }

  warn(message: string, data?: any): void {
    console.warn(this.formatLog('WARN', message, data));
  }

  error(message: string, error?: Error | any): void {
    const errorObj = error instanceof Error ? { message: error.message, stack: error.stack } : error;
    console.error(this.formatLog('ERROR', message, errorObj));
  }

  debug(message: string, data?: any): void {
    if (process.env.DEBUG === 'true') {
      console.debug(this.formatLog('DEBUG', message, data));
    }
  }
}

export const logger = new Logger();
