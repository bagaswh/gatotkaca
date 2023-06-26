import { readFileSync } from 'fs';
import { GatotError } from './error';
import yaml, { YAMLException } from 'js-yaml';
import * as Z from 'zod';
import { isObject } from './utils/object';
import ms from 'ms';

const WebConfigSchema = Z.object({
  port: Z.number().optional().default(8451),
  renderMetricsFromStorage: Z.string(),
  metricsPath: Z.string().optional().default('/metrics'),
  hostname: Z.string().optional().default('0.0.0.0'),
});
export type WebConfig = Z.infer<typeof WebConfigSchema>;

const MetricSpecSchema = Z.object({
  pending_events: Z.record(Z.null()),
});

const MetricNameSchema = MetricSpecSchema.keyof();
export type MetricName = Z.infer<typeof MetricNameSchema>;

const QuerierClientConfigSchema = Z.object({
  // TODO: Support another client such as Kafka or MySQL
  type: Z.enum(['redis']),
  queryType: Z.enum(['ListCount', 'Value']),
  metricSpec: MetricSpecSchema,
  redis: Z.any(),
}).refine(
  (input) => {
    if (input.type == 'redis' && typeof input.redis != 'object') {
      return false;
    }
    return true;
  },
  {
    message:
      'Redis client config should be provided when using Redis client type',
  }
);
export type QuerierClientConfig = Z.infer<typeof QuerierClientConfigSchema>;

const QuerierConfigSchema = Z.object({
  name: Z.string(),
  client: QuerierClientConfigSchema,
  interval: Z.number().min(5),
  timeout: Z.number().min(5),
})
  .refine(
    (input) => {
      return input.interval >= input.timeout;
    },
    { message: 'Query interval should be higher than timeout' }
  )
  .transform((arg) => {
    if (arg.timeout == arg.interval) {
      arg.timeout -= 0.5;
    }
    return arg;
  });
export type QuerierConfig = Z.infer<typeof QuerierConfigSchema>;

// ## Metrics

// ### Prometheus
const PrometheusStorageConfigSchema = Z.object({
  metricPrefix: Z.string().optional().default('gatot_scaler_'),
  collectDefaultMetrics: Z.boolean().optional().default(false),
});
export type PrometheusStorageConfig = Z.infer<
  typeof PrometheusStorageConfigSchema
>;

// ### Azure Monitor
const AzureMonitorStorageConfigSchema = Z.object({
  tenantId: Z.string(),
  clientId: Z.string(),
  clientSecret: Z.string(),
  resourceId: Z.string(),
  region: Z.string(),
  sendInterval: Z.string(),
  capturedEvents: Z.array(Z.string()),
  namespace: Z.string().default('GatotkacaQueue'),
}).superRefine((input, ctx) => {
  const intervalMs = ms(input.sendInterval);
  if (intervalMs === undefined) {
    ctx.addIssue({
      code: Z.ZodIssueCode.custom,
      message: `Cannot parse \`sendInterval\` value of \`${input.sendInterval}\``,
    });
  }
  if (intervalMs < 60000) {
    ctx.addIssue({
      code: Z.ZodIssueCode.custom,
      message: `\`sendInterval\` cannot be less than 60s (1m)`,
    });
  }
});
export type AzureMonitorStorageConfig = Z.infer<
  typeof AzureMonitorStorageConfigSchema
>;

const MetricsStorageTypeConfigSchema = Z.enum(['prometheus', 'AzureMonitor']);
export type MetricsStorageTypeConfig = Z.infer<
  typeof MetricsStorageTypeConfigSchema
>;

const MetricsStorageConfigSchema = Z.object({
  storage: MetricsStorageTypeConfigSchema,
  name: Z.optional(Z.string()),
  prometheus: PrometheusStorageConfigSchema.optional().default({
    metricPrefix: 'gatot_scaler_',
  }),
  azuremonitor: Z.optional(AzureMonitorStorageConfigSchema),
}).superRefine((input, ctx) => {
  const createMessage = (storage: string, expectedKey: string) =>
    `Provided storage is '${storage}' but the key '${expectedKey}' is not provided`;
  if (input.storage == 'prometheus' && !input.prometheus) {
    ctx.addIssue({
      code: Z.ZodIssueCode.custom,
      message: createMessage('prometheus', 'prometheus'),
    });
  }
  if (input.storage == 'AzureMonitor' && !input.azuremonitor) {
    ctx.addIssue({
      code: Z.ZodIssueCode.custom,
      message: createMessage('AzureMonitor', 'azuremonitor'),
    });
  }
});
export type MetricsStorageConfig = Z.infer<typeof MetricsStorageConfigSchema>;

export type LogLevels = 'warn' | 'error' | 'info' | 'debug';
const ConfigSchema = Z.object({
  queriers: Z.array(QuerierConfigSchema).min(1),
  metrics: Z.array(MetricsStorageConfigSchema),
  web: WebConfigSchema,
  logLevel: Z.enum(['debug', 'warning', 'error', 'info']),
});
export type Config = Z.infer<typeof ConfigSchema>;

export class ConfigError extends GatotError {}
export class ConfigValidationError extends ConfigError {}
export class ConfigIOError extends ConfigError {}
export class ConfigParseError extends ConfigError {}

function parseCfgStringValue(val: string | number | boolean) {
  let match: RegExpMatchArray | null = null;
  if (
    typeof val == 'string' &&
    (match = (val as string).match(/\$\{ENV:(.+?)\}/))
  ) {
    return process.env[match[1]];
  }
  return val;
}

function walk(
  obj: any,
  root?: any,
  key?: any,
  cb?: (root: any, key: any, val: any) => void
): void {
  if (Array.isArray(obj)) {
    obj.forEach(function (element, index) {
      walk(element, obj, index, cb);
    });
  } else if (isObject(obj)) {
    for (var property in obj) {
      if (obj.hasOwnProperty(property)) {
        walk(obj[property], obj, property, cb);
      }
    }
  } else {
    if (typeof cb == 'function') {
      cb(root, key, obj);
    }
  }
}

export function readConfigFile(cfgPath: string): Config | undefined {
  try {
    const file = readFileSync(cfgPath, 'utf-8');
    const cfg = yaml.load(file) as object;
    const parsedCfg = ConfigSchema.parse(cfg);
    for (const querier of parsedCfg.queriers) {
      querier.interval *= 1000;
      querier.timeout *= 1000;
    }
    walk(parsedCfg, undefined, undefined, (obj: any, key: any, val: any) => {
      obj[key] = parseCfgStringValue(val);
    });
    return parsedCfg;
  } catch (err: any) {
    if (err instanceof YAMLException) {
      throw new ConfigParseError('Failed to parse YAML config', err);
    }
    if (err instanceof Z.ZodError) {
      throw new ConfigValidationError(
        `Config file is not valid according to schema: ${err.message}`,
        err
      );
    }
    throw new ConfigIOError(`Cannot read config file: ${err.message}`, err);
  }
}
