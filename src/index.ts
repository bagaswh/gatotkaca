import yaml from 'js-yaml';
import { program } from 'commander';
import { Config, readConfigFile } from './config';
import Querier from './querier/querier';

program
  .requiredOption('--config.file <configFile>', 'Config file path')
  .option('--print.config', 'Print config to stderr');

program.parse();

const opts = program.opts();
const config = readConfigFile(opts['config.file']) as Config;

if (opts['print.config']) {
  console.error(yaml.dump(config));
}

const querier = new Querier(config);
querier.setup();
