import { createClient } from '@redis/client';
import { QuerierClientConfig } from './../config';
import {
  RedisListCounterQuerierClient,
  RedisValueQuerierClient,
} from './redis';
export type QueryResult = {
  key: string;
  value: string | number;
};

export default abstract class QuerierClient {
  abstract query(key: string): Promise<QueryResult>;
  abstract init(): Promise<void>;
}

export class NoopQuerierClient implements QuerierClient {
  query(key: string): Promise<QueryResult> {
    return Promise.resolve({ key: 'none', value: -1 });
  }

  init() {
    return Promise.resolve();
  }
}

export class QuerierClientFactory<T> {
  public static create(cfg: QuerierClientConfig): QuerierClient {
    if (cfg.type == 'redis') {
      switch (cfg.queryType) {
        case 'ListCount': {
          const redisCfg = cfg.redis;
          const client = createClient(redisCfg);
          return new RedisListCounterQuerierClient(client);
        }
        case 'Value': {
          const redisCfg = cfg.redis;
          const client = createClient(redisCfg);
          return new RedisValueQuerierClient(client);
        }
      }
    }
    return new NoopQuerierClient();
  }
}
