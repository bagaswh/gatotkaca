import winston, { createLogger as winstonCreateLogger, Logger } from 'winston';

type ChildLoggerMetadata = {
  component?: string;
};

export function createLogger(
  context: string,
  logLevel: string = 'info',
  config: ChildLoggerMetadata = {}
) {
  return winstonCreateLogger({
    level: logLevel,
    format: winston.format.json(),
    defaultMeta: { context, ...config },
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
      }),
    ],
  });
}
