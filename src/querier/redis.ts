import {
  RedisClientType,
  RedisFunctions,
  RedisModules,
  RedisScripts,
} from 'redis';
import logger from '../logger';
import { QuerierClient, ClientInitError, QueryResult } from './client';

/**
 * Redis querier can be configured to query the number of items in a list of
 * an integer value of a key, in case the job count is stored in a single key.
 */

class RedisClient {
  constructor(
    protected readonly client: RedisClientType<
      RedisModules,
      RedisFunctions,
      RedisScripts
    >
  ) {}

  init() {
    logger.info(`Connecting to Redis at url ${this.client.options?.url} `);
    return new Promise<void>((resolve, reject) => {
      function onError(err: any) {
        reject(
          new ClientInitError(
            `Failed connecting to Redis host: ${err.message}`,
            err
          )
        );
      }
      this.client.on('error', onError);
      this.client
        .connect()
        .then(() => {
          logger.info('Connected to Redis host');
          resolve();
        })
        .catch(onError);
    });
  }
}

export class RedisListCounterQuerierClient
  extends RedisClient
  implements QuerierClient
{
  async query(key: string): Promise<QueryResult> {
    const value = await this.client.LLEN(key);
    return {
      key,
      value,
    };
  }
}

export class RedisValueQuerierClient
  extends RedisClient
  implements QuerierClient
{
  async query(key: string): Promise<QueryResult> {
    return { key, value: (await this.client.GET(key)) || -1 };
  }
}
