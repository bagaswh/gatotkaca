import winston, { createLogger as winstonCreateLogger, Logger } from 'winston';

const logger = winstonCreateLogger({
  level: 'debug',
  format: winston.format.json(),
  defaultMeta: { service: 'gatot' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

type ChildLoggerMetadata = {
  component: string;
};

export function createLogger(config: ChildLoggerMetadata) {
  return logger.child(config);
}

export default logger;
