import { RedisClientType } from 'redis';
import QuerierClient, { QueryResult } from './client';

/**
 * Redis querier can be configured to query the number of items in a list of
 * an integer value of a key, in case the job count is stored in a single key.
 */

export class RedisClient {
  constructor(protected readonly client: RedisClientType) {}
}

export class RedisListCounterQuerier
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

export class RedisValueQuerier extends RedisClient implements QuerierClient {
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
