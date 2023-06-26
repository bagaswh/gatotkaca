import url, { URL, URLSearchParams } from 'url';

import axios from 'axios';

import { GatotError } from './../error';
import { AzureMonitorStorageConfig } from '../config';
import { Metric, MetricsStorage } from './metrics';
import ms from 'ms';
import retry from 'async-retry';
import { createLogger } from '../logger';
import app from '../app';
import { Logger } from 'winston';

export class AzureMonitorMetricsStorageError extends GatotError {}

interface AzureMonitorMetricSeries {
  dimValues: string[];
  min: number;
  max: number;
  sum: number;
  count: number;
}

interface AzureMonitorMetricPayload {
  time: string;
  data: {
    baseData: {
      metric: string;
      namespace: string;
      dimNames: string[];
      series: AzureMonitorMetricSeries[];
    };
  };
}

export class AzureMonitorMetricsStorageAPIError extends AzureMonitorMetricsStorageError {
  private errorCode: string;
  private errorDescription: string;
  private errorCodes: string;
  private timestamp: string;
  private traceId: string;
  private correlationId: string;
  private errorUri: string;

  constructor(response: any, originalError?: Error) {
    const message = response.error.message || response.error_description;
    super(message, originalError);

    this.errorCode = response.error.code || response.error;
    this.errorDescription = message;
    this.errorCodes = response.error_codes;
    this.timestamp = response.timestamp;
    this.traceId = response.trace_id;
    this.correlationId = response.correlation_id;
    this.errorUri = response.error_uri;
  }
}

export class AzureMonitorMetricsStorageAPIAuthError extends AzureMonitorMetricsStorageAPIError {}

export class AzureMonitorMetricsStorage implements MetricsStorage {
  // In-memory auth token
  // TODO: Persist in storage so it endures program restarts.
  private authToken: string = '';

  private logger: Logger;

  // For batch send
  private sendBatch: Metric[] = [];
  private batchIntervalRunning = false;
  private batchIntervalShouldStop = false;

  constructor(private readonly cfg: AzureMonitorStorageConfig) {
    this.logger = createLogger(
      `azure-monitor-storage:${this.cfg.resourceId}`,
      app.config().logLevel
    );
  }

  private async acquireAuthToken() {
    const clientId = this.cfg.clientId;
    const clientSecret = this.cfg.clientSecret;
    const tenantId = this.cfg.tenantId;

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('resource', 'https://monitor.azure.com');
    const url = new URL(`https://login.microsoftonline.com`);
    url.pathname = `${tenantId}/oauth2/token`;
    const res = await axios.post(url.href, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      validateStatus: (status) => status < 500,
    });
    if ([401, 403].includes(res.status)) {
      throw new AzureMonitorMetricsStorageAPIAuthError(res.data);
    }
    const data = res.data;
    return data.access_token;
  }

  private async sendMetric({
    dimValues,
    min,
    max,
    sum,
    count,
  }: AzureMonitorMetricSeries) {
    const data: AzureMonitorMetricPayload = {
      time: new Date().toISOString(),
      data: {
        baseData: {
          metric: 'Queue Length',
          namespace: this.cfg.namespace,
          dimNames: ['QueueName'],
          series: [
            {
              dimValues,
              min,
              max,
              sum,
              count,
            },
          ],
        },
      },
    };
    const url = new URL(`https://${this.cfg.region}.monitoring.azure.com`);
    url.pathname = `${this.cfg.resourceId}/metrics`;
    return retry(async (bail: Function) => {
      const res = await axios.post(url.href, data, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
        validateStatus: (status) => status < 500,
      });
      if (res.status >= 400 && res.status <= 499) {
        bail(new AzureMonitorMetricsStorageAPIError(res.data));
        return;
      }
      return res;
    });
  }

  private batchIntervalFn() {
    const batchItems = this.sendBatch.splice(0);
    if (!batchItems.length) {
      return;
    }

    const values = batchItems.map((item) => item.value);
    // aggregate
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const count = batchItems.length;
    this.logger.info('Sending metrics');
    return this.sendMetric({
      dimValues: [batchItems[0].labels.key],
      min,
      max,
      sum,
      count,
    });
  }

  private batchIntervalLoop() {
    if (this.batchIntervalShouldStop) {
      return;
    }

    setTimeout(async () => {
      try {
        await this.batchIntervalFn();
        this.logger.debug('Metrics sent');
      } catch (err: any) {
        console.error(err);
        this.logger.error(`Batch interval failed: ${err}`);
      }
      this.batchIntervalLoop();
    }, ms(this.cfg.sendInterval));
  }

  async insert(metric: Metric): Promise<any> {
    this.logger.debug(`got insert request with metric: ${metric.labels.key}`);
    if (!this.cfg.capturedEvents.includes(metric.labels.key)) {
      this.logger.debug(`metric ${metric.labels.key} ignored`);
      // ignore non-captured events
      return;
    }

    this.sendBatch.push(metric);

    if (this.batchIntervalRunning) {
      // batch interval is already running
      return;
    }

    // interval has not run, setup everything
    if (!this.authToken) {
      try {
        const authToken = await this.acquireAuthToken();
        this.authToken = authToken;
      } catch (err: any) {
        if (err.response?.data) {
          throw new AzureMonitorMetricsStorageAPIError(err.response.data, err);
        }
        throw err;
      }
    }

    this.batchIntervalLoop();
    this.batchIntervalRunning = true;
  }

  render(): Promise<string> {
    throw new AzureMonitorMetricsStorageError('Not implemented');
  }
}
