import { GatotError, ValueError } from './../error';
import { createLogger } from '../logger';
import { MetricsStorage } from '../metrics/metrics';
import { Config, QuerierConfig, QuerierClientConfig } from './../config';
import { Scheduler } from '../scheduler';
import { nanoid } from 'nanoid';
import { Logger } from 'winston';
import { QuerierClient } from './client/client';
import { QuerierClientFactory } from './client/factory';
import { ClientError } from './client/error';
import { isObject } from '../utils/object';

export class QuerierError extends GatotError {}

export default class Querier {
  private readonly scheduler: Scheduler;
  private readonly logger: Logger;
  private readonly idMaps: {
    [key: string]: {
      config: QuerierConfig;
      client: QuerierClient;
    };
  };

  constructor(
    private readonly config: Config,
    private readonly metricsStorage: MetricsStorage
  ) {
    this.scheduler = Scheduler.getInstance();
    this.idMaps = {};
    this.logger = createLogger({
      component: 'Querier',
    });
  }

  private createClient(cfg: QuerierClientConfig) {
    return QuerierClientFactory.create(cfg);
  }

  async init() {
    // setup querier schedule
    for (const querierConfig of this.config.queriers || []) {
      try {
        // setup querier client
        this.logger.info(
          `Setting up querier for querier ${querierConfig.name}`
        );
        const id = nanoid(21);
        const client = this.createClient(querierConfig.client);
        this.logger.info(
          `Initializing client for querier ${querierConfig.name}`
        );
        await client.init();
        this.logger.info(
          `Initialized client for querier ${querierConfig.name}`
        );
        this.idMaps[id] = {
          config: querierConfig,
          client,
        };
        this.scheduler.register(
          id,
          querierConfig.name,
          querierConfig.interval,
          (id) => {
            return this.query(id);
          }
        );
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
  }

  private async queryAndInsert(
    client: QuerierClient,
    queryName: string,
    metricName: string,
    queryKey: string,
    labels: object = {}
  ) {
    const result = await client.query(queryKey);
    this.metricsStorage.insert({
      name: metricName,
      value: Number(result.value),
      timestamp: Date.now(),
      labels: {
        name: queryName,
        key: queryKey,
      },
    });
  }

  async query(id: string) {
    if (!this.idMaps[id]) {
      return;
    }
    const querier = this.idMaps[id];
    try {
      this.logger.debug(`Start querying metricSpec for ${querier.config.name}`);
      const metricSpec = querier.config.client.metricSpec;
      let tasks = [];
      for (const [metricName, value] of Object.entries(metricSpec)) {
        const spec = value;
        for (const [key, keyDesc] of Object.entries(spec)) {
          tasks.push(
            this.queryAndInsert(
              querier.client,
              querier.config.name,
              metricName,
              key
            )
          );
        }
        if (tasks.length >= 5) {
          await Promise.all(tasks);
          tasks = [];
        }
      }
      await Promise.all(tasks);
      tasks = [];
      this.logger.debug(`Queried all metricSpec for ${querier.config.name}`);
    } catch (err: any) {
      this.logger.error('Query failed with error:' + err.message);
    }
  }
}
