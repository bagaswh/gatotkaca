import { readFileSync } from 'fs';
import { GatotError } from './error';
import yaml, { YAMLException } from 'js-yaml';
import * as Z from 'zod';
import { isObject } from './utils/object';

const QuerierClientConfigSchema = Z.object({
  // TODO: Support another client such as Kafka or MySQL
  type: Z.enum(['redis']),
  queryType: Z.enum(['ListCount', 'Value']),
  key: Z.string(),
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
  interval: Z.number().min(60),
  timeout: Z.number().min(1),
}).refine(
  (input) => {
    return input.interval > input.timeout;
  },
  { message: 'Query interval should be higher than timeout' }
);
export type QuerierConfig = Z.infer<typeof QuerierConfigSchema>;

const PrometheusStorageConfigSchema = Z.object({
  metricPrefix: Z.string().optional().default('gatot_scaler_'),
  collectDefaultMetrics: Z.boolean().optional().default(false),
});
export type PrometheusStorageConfig = Z.infer<
  typeof PrometheusStorageConfigSchema
>;

const MetricsStorageConfigSchema = Z.object({
  storage: Z.enum(['prometheus', 'AzureMonitor']),
  prometheus: PrometheusStorageConfigSchema.optional().default({
    metricPrefix: 'gatot_scaler_',
  }),
});
export type MetricsStorageConfig = Z.infer<typeof MetricsStorageConfigSchema>;

const ConfigSchema = Z.object({
  queriers: Z.array(QuerierConfigSchema).min(1),
  metrics: MetricsStorageConfigSchema,
});
export type Config = Z.infer<typeof ConfigSchema>;

class ConfigError extends GatotError {
  constructor(message: string, originalError: Error) {
    super(message, originalError);
  }
}

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
      throw new ConfigError('Failed to parse YAML config', err);
    }
    if (err instanceof Z.ZodError) {
      throw new ConfigError(
        `Config file is not a valid according to schema: ${err.message}`,
        err
      );
    }
    throw new ConfigError(`Cannot read config file: ${err.message}`, err);
  }
}
