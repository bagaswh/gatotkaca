import yaml from 'js-yaml';
import { program } from 'commander';
import dotenv from 'dotenv';
import { Config, readConfigFile, ConfigValidationError } from './config';
import Querier from './querier/querier';
import { MetricsStorageFactory } from './metrics/metrics';
import { WebServer } from './metrics/web';
import { createLogger } from './logger';

dotenv.config();

program
  .requiredOption('--config.file <configFile>', 'Config file path')
  .option('--print.config', 'Print config to stderr');

program.parse();

const logger = createLogger('main');

const opts = program.opts();
let config;
try {
  config = readConfigFile(opts['config.file']) as Config;
} catch (err: any) {
  if (err instanceof ConfigValidationError) {
    logger.error(`Failed to validate config file: ${err.message}`);
    process.exit(1);
  } else {
    throw err;
  }
}

if (opts['print.config']) {
  console.error(yaml.dump(config));
}

const metricsStorage = MetricsStorageFactory.create(config.metrics);
const querier = new Querier(config, metricsStorage);
querier.init();

const webserver = new WebServer(metricsStorage, config);
webserver.start();
