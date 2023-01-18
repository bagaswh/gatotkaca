import { GatotError } from './../error';
import logger from '../logger';
import { MetricsStore } from '../metrics/metrics';
import { Config, QuerierConfig, QuerierClientConfig } from './../config';
import { QuerierClient, ClientError, QuerierClientFactory } from './client';
import { Scheduler } from './scheduler';
import { nanoid } from 'nanoid';

export class QuerierError extends GatotError {}

export default class Querier {
  private readonly scheduler: Scheduler;
  private readonly metricsStore: MetricsStore;
  private readonly idMaps: {
    [key: string]: {
      config: QuerierConfig;
      client: QuerierClient;
    };
  };

  constructor(private readonly config: Config) {
    this.scheduler = Scheduler.getInstance();
    this.metricsStore = MetricsStore.getInstance(config.metrics);
    this.idMaps = {};
  }

  private createClient(cfg: QuerierClientConfig) {
    return QuerierClientFactory.create(cfg);
  }

  async setup() {
    // setup querier schedule
    for (const querierConfig of this.config.queriers || []) {
      try {
        // setup querier client
        logger.info(`Setting up querier for querier ${querierConfig.name}`);
        const id = nanoid(21);
        const client = this.createClient(querierConfig.client);
        logger.info(`Initializing client for querier ${querierConfig.name}`);
        await client.init();
        logger.info(`Initialized client for querier ${querierConfig.name}`);
        this.idMaps[id] = {
          config: querierConfig,
          client,
        };
        this.scheduler.register(id, querierConfig.name, querierConfig.interval);
      } catch (err: any) {
        if (err instanceof ClientError) {
          throw new QuerierError(
            `Failed connecting to querier client: ${err.message}`,
            err
          );
        }
        throw new GatotError(`Failed setting up querier: ${err.message}`, err);
      }
    }
    this.scheduler.on('interval', ({ id }) => this.query(id));
  }

  async query(id: string) {
    if (!this.idMaps[id]) {
      return;
    }
    const querier = this.idMaps[id];
    try {
      const result = await querier.client.query(querier.config.client.key);
      // this.metricsStore.insert(result);
    } catch (err: any) {
      logger.error('Query failed with error:' + err.message);
    }
  }
}
