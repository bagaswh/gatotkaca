import { MetricsStorageConfig } from '../config';

abstract class MetricsStorage {
    insert(metric: any) {}
}

class PrometheusStore implements MetricsStorage {
    constructor(private readonly cfg: any) {}

    insert(metric: any) {}
}

export default class MetricsStore {
    private static instance: MetricsStore | null = null;
    private metricsStorage: MetricsStorage;

    private constructor(metricsStorageConfig: MetricsStorageConfig) {
        this.metricsStorage = new PrometheusStore(metricsStorageConfig);
    }

    static getInstance(metricsStorageConfig: MetricsStorageConfig) {
        if (MetricsStore.instance === null) {
            MetricsStore.instance = new MetricsStore(metricsStorageConfig);
        }
        return MetricsStore.instance;
    }

    insert(metric: any) {
        this.metricsStorage.insert(metric);
    }
}
