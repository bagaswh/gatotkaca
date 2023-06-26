import { Logger } from 'winston';
import app from '../app';
import { GatotError } from '../error';
import { createLogger } from '../logger';
import { MetricsStorageConfig, MetricsStorageTypeConfig } from './../config';
import { Metric, MetricsStorage, MetricsStorageFactory } from './metrics';

export class MetricsStorageMangerError extends GatotError {}

export class MetricsStorageManager {
  private static instance: MetricsStorageManager;
  private logger: Logger;
  private storages: Map<
    string,
    {
      type: MetricsStorageTypeConfig;
      storage: MetricsStorage;
    }
  >;

  private constructor(private readonly cfg: MetricsStorageConfig[]) {
    this.logger = createLogger('metrics-storage-manager', app.getLogLevel());
    this.storages = new Map();
  }

  public static getInstance(cfg: MetricsStorageConfig[]) {
    if (!this.instance) {
      this.instance = new this(cfg);
    }
    return this.instance;
  }

  public init() {
    for (const cfg of this.cfg) {
      const name = cfg.name || cfg.storage;
      if (this.storages.has(name)) {
        throw new MetricsStorageMangerError(
          `Metrics storage ${name} already exists. Cannot have two or more storage with the same name.`
        );
      }
      this.storages.set(name, {
        type: cfg.storage,
        storage: MetricsStorageFactory.create(cfg),
      });
    }
  }

  public getStorage(name: string) {
    return this.storages.get(name);
  }

  private async runBatchedTasks(tasks: Promise<any>[]) {
    const result = await Promise.allSettled(tasks);
    for (const item of result) {
      if (item.status == 'rejected') {
        this.logger.error(`Failed inserting to storage: ${item.reason}`);
      }
    }
  }

  public async insertToAll(metric: Metric) {
    let tasks = [];
    for (const [key, storageDef] of this.storages.entries()) {
      const storage = storageDef.storage;
      tasks.push(storage.insert(metric));
      if (tasks.length >= 10) {
        await this.runBatchedTasks(tasks);
        tasks = [];
      }
    }
    await this.runBatchedTasks(tasks);
    tasks = [];
  }
}

const metricsStorageManager = MetricsStorageManager.getInstance(
  app.config().metrics
);
metricsStorageManager.init();
export default metricsStorageManager;
