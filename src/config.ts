import EPAError from './error';

export type QuerierBuiltinSource = 'redis' | 'mysql';
export type QuerierBuiltinQueryType = 'ListCount' | 'Value';

export type QuerierBuiltinConfig = {
  source: QuerierBuiltinSource;
  queryType: QuerierBuiltinQueryType;
};

export type AutoscaleMetricConfig = {
  metricName: 'pending_events';
  operator: '<' | '<=' | '=' | '>=' | '>';
  metricThreshold: number;
  durationInMinutes: number;
  aggregation: 'avg' | 'min' | 'max' | 'sum' | 'last' | 'count';
};
export type AutoscaleActionConfig = {
  operation:
    | 'increase_count_by'
    | 'increase_percent_by'
    | 'increase_count_to'
    | 'decrease_count_by'
    | 'decrease_percent_by'
    | 'decrease_count_to';
};
export type AutoscaleRuleConfig = {
  type: 'ScaleIn' | 'ScaleOut';
  scope: string;
  metric: AutoscaleMetricConfig;
  action: AutoscaleActionConfig;
};
export type AutoscaleConditionScaleMode = 'Metric' | 'FixedInstance';
export type AutoscaleConditionConfig = {
  id?: string;
  name: string;
  scaleMode: AutoscaleConditionScaleMode;
  rules: AutoscaleRuleConfig[];
  instanceLimits: {
    min: number;
    max: number;
    default: number;
  };
};

export type AutoscaleConfig = {
  autoscaleConditions: AutoscaleConditionConfig[];
};

export type Config = {
  autoscaleConfigs: AutoscaleConfig[];
};

class ConfigError extends EPAError {
  constructor(message: string, originalError: Error) {
    super(message, originalError);
  }
}

function validateConfig(json: object) {}

export function readConfigFile(
  cfgPath: string
): QuerierBuiltinConfig | undefined {
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
