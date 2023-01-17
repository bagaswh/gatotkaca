import { RedisClientType } from "redis";

/**
 * Redis querier can be configured to query the number of items in a list of
 * an integer value of a key, in case the job count is stored in a single key.
 */

export function getNumberOfItemsInKey(client: RedisClientType, key: string) {
    return client.LLEN(key);
}

export function getValueOfKey(client: RedisClientType, key: string) {
    return client.GET(key);
}