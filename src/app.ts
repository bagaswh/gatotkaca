import yaml from 'js-yaml';
import { Logger } from 'winston';
import { program } from 'commander';
import dotenv from 'dotenv';
import { Config, readConfigFile, ConfigValidationError } from './config';
import { createLogger } from './logger';

/**
 * Container for all what you need.
 */

export class App {
  private conf: Config;

  constructor(
    private readonly configFile: string,
    private readonly logger: Logger
  ) {
    this.conf = {} as Config;
    this.parseConfig();
  }

  public getLogLevel() {
    return this.conf.logLevel;
  }

  private parseConfig() {
    let config;
    try {
      config = readConfigFile(this.configFile) as Config;
      this.conf = config;
    } catch (err: any) {
      if (err instanceof ConfigValidationError) {
        this.logger.error(`Failed to validate config file: ${err.message}`);
        process.exit(1);
      } else {
        throw err;
      }
    }
  }

  dumpConfig() {
    return yaml.dump(this.conf);
  }

  config() {
    return this.conf;
  }
}

dotenv.config();

program
  .requiredOption('--config.file <configFile>', 'Config file path')
  .option('--print.config', 'Print config to stderr');

program.parse();

const opts = program.opts();

const app = new App(opts['config.file'], createLogger('app', 'info'));
export default app;

if (opts['print.config']) {
  console.error(app.config());
}
