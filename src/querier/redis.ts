import {
  RedisClientType,
  RedisFunctions,
  RedisModules,
  RedisScripts,
} from 'redis';
import QuerierClient, { QueryResult } from './client';

/**
 * Redis querier can be configured to query the number of items in a list of
 * an integer value of a key, in case the job count is stored in a single key.
 */

export class RedisListCounterQuerierClient implements QuerierClient {
  public constructor(
    private readonly client: RedisClientType<
      RedisModules,
      RedisFunctions,
      RedisScripts
    >
  ) {}

  init() {
    return this.client.connect();
  }

  async query(key: string): Promise<QueryResult> {
    const value = await this.client.LLEN(key);
    return {
      key,
      value,
    };
  }
}

export class RedisValueQuerierClient implements QuerierClient {
  public constructor(
    private readonly client: RedisClientType<
      RedisModules,
      RedisFunctions,
      RedisScripts
    >
  ) {}

  init() {
    return this.client.connect();
  }

  async query(key: string): Promise<QueryResult> {
    return { key, value: (await this.client.GET(key)) || -1 };
  }
}

export function getNumberOfItemsInKey(client: RedisClientType, key: string) {
  return client.LLEN(key);
}

export function getValueOfKey(client: RedisClientType, key: string) {
  return client.GET(key);
}
