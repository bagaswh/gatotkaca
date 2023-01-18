import { MetricsStorageConfig } from '../config';
import { PrometheusStorage } from './prometheus';

export interface Metric {
  name: string;
  value: number;
  timestamp: number;
}

export abstract class MetricsStorage {
  abstract insert(metric: Metric): void;
}

class NothingStorage implements MetricsStorage {
  insert(metric: Metric) {}
}

class MetricsStorageFactory {
  public static create(cfg: MetricsStorageConfig) {
    switch (cfg.storage) {
      case 'prometheus':
        return new PrometheusStorage(cfg.prometheus);
      default:
        return new NothingStorage();
    }
  }
}

export class MetricsStore {
  private static instance: MetricsStore | null = null;
  private metricsStorage: MetricsStorage;

  private constructor(cfg: MetricsStorageConfig) {
    this.metricsStorage = this.createStorage(cfg);
  }

  private createStorage(cfg: MetricsStorageConfig) {
    return MetricsStorageFactory.create(cfg);
  }

  static getInstance(metricsStorageConfig: MetricsStorageConfig) {
    if (MetricsStore.instance === null) {
      MetricsStore.instance = new MetricsStore(metricsStorageConfig);
    }
    return MetricsStore.instance;
  }

  insert(metric: Metric) {
    this.metricsStorage.insert(metric);
  }
}
