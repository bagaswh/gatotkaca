import yaml from 'js-yaml';
import { program } from 'commander';
import { Config, ConfigError, readConfigFile } from './config';
import Querier from './querier/querier';
import { MetricsStorageFactory } from './metrics/metrics';
import { initWeb } from './metrics/web';
import logger from './logger';

program
  .requiredOption('--config.file <configFile>', 'Config file path')
  .option('--print.config', 'Print config to stderr');

program.parse();

const opts = program.opts();
let config;
try {
  config = readConfigFile(opts['config.file']) as Config;
} catch (err: any) {
  if (err instanceof ConfigError) {
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

initWeb(config.web, metricsStorage);
