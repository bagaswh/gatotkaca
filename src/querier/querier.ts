import logger from '../logger';
import MetricsStore from '../metrics/metrics-store';
import { Config, QuerierConfig } from './../config';
import QuerierClient from './client';
import { Scheduler } from './scheduler';

export default class Querier {
  private readonly scheduler: Scheduler;
  private readonly metricsStore: MetricsStore;
  private readonly idMaps: {
    [key: string]: QuerierConfig & { client: QuerierClient };
  };

  constructor(private readonly config: Config) {
    this.setupQuerierInterval();

    this.scheduler = Scheduler.getInstance();
    this.metricsStore = MetricsStore.getInstance(config.metrics);
    this.idMaps = {};
  }

  setupQuerierInterval() {
    for (const querierConfig of this.config.queriers || []) {
      this.scheduler.register(querierConfig.name, querierConfig.interval);
    }
    this.scheduler.on('interval', ({ id }) => this.query(id));
  }

  async query(id: string) {
    if (!this.idMaps[id]) {
      return;
    }
    const querier = this.idMaps[id];
    try {
      const result = await querier.client.query(querier.queryKey);
      this.metricsStore.insert(result);
    } catch (err: any) {
      logger.error('Query failed with error:' + err.message);
    }
  }
}
