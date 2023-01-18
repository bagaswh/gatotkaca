import { PrometheusStorageConfig } from './../config';
import { Metric, MetricsStorage } from './metrics';
import { collectDefaultMetrics, Registry, Gauge } from 'prom-client';

export class PrometheusStorage implements MetricsStorage {
  private readonly registry: Registry;

  constructor(private readonly cfg: PrometheusStorageConfig) {
    this.registry = new Registry();
    if (cfg.collectDefaultMetrics) {
      collectDefaultMetrics({ register: this.registry });
    }
    this.registerMetrics();
  }

  private registerMetrics() {
    const metrics: {
      [key: string]: {
        type: 'gauge';
        help: string;
      };
    } = {
      pending_events: {
        type: 'gauge',
        help: 'The number of pending events',
      },
    };
    Object.keys(metrics).forEach((key) => {
      const metricDef = metrics[key];
      const metricPrefix = this.cfg.metricPrefix;
      switch (metricDef.type) {
        case 'gauge': {
          this.registry.registerMetric(
            new Gauge({ name: `${metricPrefix}${key}`, help: metricDef.help })
          );
        }
      }
    });
  }

  async insert(metric: Metric) {
    const metricInstance = this.registry.getSingleMetric(metric.name);
    if (metricInstance) {
      // metricInstance.
    }
  }
}
