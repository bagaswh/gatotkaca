import { URL, URLSearchParams } from 'url';
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

  constructor(response: any = {}, originalError?: Error) {
    const message = response?.error?.message || response?.error_description;
    super(message, originalError);

    this.errorCode = response?.error?.code || response?.error;
    this.errorDescription = message;
    this.errorCodes = response?.error_codes;
    this.timestamp = response?.timestamp;
    this.traceId = response?.trace_id;
    this.correlationId = response?.correlation_id;
    this.errorUri = response?.error_uri;
  }
}

function parseResourceId(resourceId: string) {
  const split = resourceId.split('/');
  const provider = split.slice(6, split.length - 1);
  const namespace = provider.slice(0, provider.length - 1)[0];
  const type = provider.slice(provider.length - 1)[0];
  return {
    resourceId,
    subscriptionId: split[2],
    resourceGroup: split[4],
    provider: {
      namespace,
      type,
      provider: provider.join('/'),
    },
    resourceName: split[split.length - 1],
  };
}

function humanReadableResourceId(resourceId: string) {
  const { subscriptionId, resourceGroup, resourceName } =
    parseResourceId(resourceId);
  return `${subscriptionId.slice(0, 7)}***/${resourceGroup}/${resourceName}`;
}

export class AzureMonitorMetricsStorageAPIAuthError extends AzureMonitorMetricsStorageAPIError {}

export class AzureMonitorMetricsStorage implements MetricsStorage {
  // In-memory auth token
  // TODO: Persist in storage so it endures program restarts.
  private authToken: string = '';

  // Flag to stop the `insert` from requesting auth token to Microsoft server since the credentials are invalid
  private invalidAzureCredentials = false;

  private logger: Logger;

  // For batch send
  // `key` is for metric name
  private sendBatches: { [key: string]: Metric[] } = {};
  private batchIntervalRunning = false;

  private isRequestingAuthToken = false;

  constructor(private readonly cfg: AzureMonitorStorageConfig) {
    this.logger = createLogger(
      `azure-monitor-storage:${humanReadableResourceId(this.cfg.resourceId)}`,
      app.config().logLevel
    );
  }

  private async acquireAuthToken() {
    if (this.isRequestingAuthToken) {
      this.logger.debug(
        'Got request to acquire auth token while token is currently being acquired, skipping'
      );
      return;
    }

    this.isRequestingAuthToken = true;

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
    this.logger.info('Acquiring auth token');
    try {
      await retry(async (bail) => {
        const res = await axios.post(url.href, params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          validateStatus: (status) => status < 500,
        });
        if ([401, 403].includes(res.status)) {
          return bail(new AzureMonitorMetricsStorageAPIAuthError(res.data));
        }
        if (res.status >= 400 && res.status <= 499) {
          return bail(new AzureMonitorMetricsStorageAPIError(res.data));
        }
        this.authToken = res.data.access_token;
      });
    } catch (err: any) {
      this.logger.error(`Failed acquiring auth token: ${err.message}`);
      throw err;
    } finally {
      this.isRequestingAuthToken = false;
    }
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
    return retry(
      async (bail: Function) => {
        const res = await axios.post(url.href, data, {
          headers: {
            Authorization: `Bearer ${this.authToken}`,
          },
          validateStatus: (status) => status < 500,
        });
        if ([401, 403].includes(res.status)) {
          if (res?.data?.Error?.Message?.includes('TokenExpired')) {
            this.logger.info('Auth token expired, reacquiring');
            await this.acquireAuthToken();
            // to trigger retry
            throw new Error();
          }
          return bail(new AzureMonitorMetricsStorageAPIAuthError(res.data));
        }
        if (res.status >= 400 && res.status <= 499) {
          return bail(new AzureMonitorMetricsStorageAPIError(res.data));
        }
        return res;
      },
      { retries: 5 }
    );
  }

  private getSendMetricsTasks() {
    const tasks = [];
    for (const key in this.sendBatches) {
      const sendBatch = this.sendBatches[key];
      const batchItems = sendBatch.splice(0);
      if (!batchItems.length) {
        return [];
      }

      const values = batchItems.map((item) => item.value);
      // aggregate
      const min = Math.min(...values);
      const max = Math.max(...values);
      const sum = values.reduce((a, b) => a + b, 0);
      const count = batchItems.length;
      this.logger.info(`Sending metrics for key ${key}`);
      tasks.push(
        this.sendMetric({
          dimValues: [batchItems[0].labels.key],
          min,
          max,
          sum,
          count,
        })
      );
    }
    return tasks;
  }

  private async settleTasks(tasks: Promise<any>[]) {
    const result = await Promise.allSettled(tasks);
    for (const item of result) {
      if (item.status == 'rejected') {
        this.logger.error(`Failed sending metric: ${item.reason}`);
      }
    }
  }

  private batchIntervalLoop() {
    setTimeout(async () => {
      const tasks = this.getSendMetricsTasks().filter((result) => !!result);
      await this.settleTasks(tasks);
      this.batchIntervalLoop();
    }, ms(this.cfg.sendInterval) as number);
  }

  async insert(metric: Metric): Promise<any> {
    if (this.invalidAzureCredentials) {
      this.logger.error(
        'Insert is requested but Azure credentials provided are invalid, skipping'
      );
      return;
    }

    const dimValue = metric.labels.key;

    if (!this.cfg.capturedEvents.includes(dimValue)) {
      // ignore non-captured events
      return;
    }

    if (!this.authToken) {
      try {
        await this.acquireAuthToken();
        this.logger.debug('Auth token acquired');
      } catch (err: any) {
        if (err instanceof AzureMonitorMetricsStorageAPIAuthError) {
          this.invalidAzureCredentials = true;
        }
        throw err;
      } finally {
        return;
      }
    }

    if (!this.sendBatches[dimValue]) {
      this.sendBatches[dimValue] = [];
    }
    this.sendBatches[dimValue].push(metric);

    if (this.batchIntervalRunning) {
      return;
    }

    this.batchIntervalLoop();
    this.batchIntervalRunning = true;
  }

  render(): Promise<string> {
    throw new AzureMonitorMetricsStorageError('Not implemented');
  }
}
