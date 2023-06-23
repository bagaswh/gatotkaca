import { program } from 'commander';
import dotenv from 'dotenv';
import Querier from './querier/querier';
import { MetricsStorageFactory } from './metrics/metrics';
import { WebServer } from './metrics/web';
import { createLogger } from './logger';
import app from './app';

dotenv.config();

program.parse();

async function main() {
  const logger = createLogger('main');
  let config = app.config();

  logger.info('Starting querier');
  const querier = new Querier(config);
  querier.init();

  logger.info('Stating webserver');
  const webserver = new WebServer(config);
  webserver.start();
}

main();
