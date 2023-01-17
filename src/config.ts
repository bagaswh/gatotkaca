import { EPAError } from './error';

/**
 * Querier
 */
export type QuerierSource = 'redis' | 'mysql';
export type QuerierQueryType = 'ListCount' | 'Value';

export type QuerierConfig = {
  name: string;
  source: QuerierSource;
  queryKey: string;
  queryType: QuerierQueryType;
  interval: number;
  timeout: number;
};

/**
 * Metrics storage
 */
export type MetricsStorageConfig = {
  storage: 'prometheus' | 'azure_monitor';
};

/**
 * Autoscaler
 */
export type AutoscaleMetricConfig = {
  metricName: 'pending_events';
  operator: '<' | '<=' | '=' | '>=' | '>';
  metricThreshold: number;
  durationInMinutes: number;
  aggregation: 'avg' | 'min' | 'max' | 'sum' | 'last' | 'count';
};
export type AutoscaleActionConfig = {
  operation: // increase
  | 'increase_count_by'
    | 'increase_percent_by'
    | 'increase_count_to'
    // decrease
    | 'decrease_count_by'
    | 'decrease_percent_by'
    | 'decrease_count_to';
  value: number;
  cooldownInMinutes: number;
};
export type AutoscaleRuleConfig = {
  type: 'ScaleIn' | 'ScaleOut';
  resource: 'CurrentScope' | string;
  metric: AutoscaleMetricConfig;
  action: AutoscaleActionConfig;
};
export type AutoscaleConditionScaleMode =
  | 'Metric'
  | 'Webhook'
  | 'FixedInstance';
export type AutoscaleConditionConfig = {
  id?: string;
  name: string;
  scaleMode: AutoscaleConditionScaleMode;
  scope: string;
  rules?: AutoscaleRuleConfig[];
  instanceLimits?: {
    min: number;
    max: number;
    default: number;
  };
  instanceCount?: number;
};

export type AutoscaleConfig = {
  autoscaleConditions: AutoscaleConditionConfig[];
};

export type Config = {
  autoscaleConfigs?: AutoscaleConfig[];
  queriers?: QuerierConfig[];
  metrics: MetricsStorageConfig;
};

class ConfigError extends EPAError {
  constructor(message: string, originalError: Error) {
    super(message, originalError);
  }
}

function validateConfig(json: object) {}

export function readConfigFile(cfgPath: string): Config | undefined {
  try {
    const json = JSON.parse(cfgPath);
    validateConfig(json);
    return json;
  } catch (err: any) {
    if (err instanceof SyntaxError) {
      throw new ConfigError('Failed to parse JSON config', err);
    }
  }
}
