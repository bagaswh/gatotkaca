import {
  RedisClientType,
  RedisFunctions,
  RedisModules,
  RedisScripts,
} from 'redis';
import logger from '../../logger';
import { QuerierClient, QueryResult } from './client';
import { ClientInitError, ClientQueryError } from './error';

/**
 * Redis querier can be configured to query the number of items in a list or
 * an integer value of a key, in case the job count is stored in a single key.
 */

export class RedisClientInitError extends ClientInitError {}
export class RedisClientQueryError extends ClientQueryError {}

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
    this.client.on('error', () => console.error('si badut'));
    return new Promise<void>((resolve, reject) => {
      function onError(err: any) {
        reject(
          new RedisClientInitError(
            `Failed connecting to Redis host: ${err.message}`,
            err
          )
        );
      }
      this.client.once('error', onError);
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
    try {
      return {
        key,
        value: await this.client.LLEN(key),
      };
    } catch (err: any) {
      throw new RedisClientQueryError(`Failed querying: ${err.message}`);
    }
  }
}

export class RedisValueQuerierClient
  extends RedisClient
  implements QuerierClient
{
  async query(key: string): Promise<QueryResult> {
    try {
      return {
        key,
        value: (await this.client.GET(key)) || -1,
      };
    } catch (err: any) {
      throw new RedisClientQueryError(`Failed querying: ${err.message}`);
    }
  }
}
