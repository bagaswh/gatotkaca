import { QuerierClientConfig } from '../../config';
import { NoopQuerierClient, QuerierClient } from './client';
import { createClient } from '@redis/client';
import {
  RedisListCounterQuerierClient,
  RedisValueQuerierClient,
} from './redis';

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
