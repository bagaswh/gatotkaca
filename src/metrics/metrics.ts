import { AzureMonitorMetricsStorage } from './azure-monitor';
import { AzureMonitorStorageConfig, MetricsStorageConfig } from '../config';
import { PrometheusStorage } from './prometheus';

export interface Metric {
  name: string;
  labels: {
    key: string;

    [key: string]: string;
  };
  value: number;
  timestamp: number;
}

export abstract class MetricsStorage {
  abstract insert(metric: Metric): Promise<any>;
  abstract render(): Promise<string>;
}

class NothingStorage implements MetricsStorage {
  insert(metric: Metric) {
    return Promise.resolve('');
  }

  render() {
    return Promise.resolve('');
  }
}

export class MetricsStorageFactory {
  public static create(cfg: MetricsStorageConfig): MetricsStorage {
    switch (cfg.storage) {
      case 'prometheus':
        return new PrometheusStorage(cfg.prometheus);
      case 'AzureMonitor':
        return new AzureMonitorMetricsStorage(
          cfg.azuremonitor as AzureMonitorStorageConfig
        );
      default:
        return new NothingStorage();
    }
  }
}
