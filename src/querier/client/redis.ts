import EventEmitter from 'events';
import {
  RedisClientType,
  RedisFunctions,
  RedisModules,
  RedisScripts,
} from 'redis';
import { createLogger } from '../../logger';
import { QuerierClient, QueryResult } from './client';
import { ClientInitError, ClientQueryError } from './error';

const logger = createLogger('redis-querier-client');

/**
 * Redis querier can be configured to query the number of items in a list or
 * an integer value of a key, in case the job count is stored in a single key.
 */

export class RedisClientInitError extends ClientInitError {}
export class RedisClientQueryError extends ClientQueryError {}

class RedisClient extends EventEmitter {
  constructor(
    protected readonly client: RedisClientType<
      RedisModules,
      RedisFunctions,
      RedisScripts
    >
  ) {
    super();
  }

  init() {
    logger.info(`Connecting to Redis at url ${this.client.options?.url} `);
    const options = this.client.options;
    return new Promise<void>((resolve, reject) => {
      function onError(err: any) {
        reject(
          new RedisClientInitError(
            `Failed connecting to Redis host ${options?.url}: ${err.message}`,
            err
          )
        );
      }
      this.client.once('error', onError);
      this.client
        .connect()
        .then(() => {
          this.client.off('error', onError);

          // register error handler for later commands
          this.client.on('error', (err) => this.emit(err));
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
      throw new RedisClientQueryError(err.message);
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
      throw new RedisClientQueryError(err.message);
    }
  }
}
