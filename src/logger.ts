import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'event-processor-autoscaler' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

export default logger;
