export type QueryResult = {
  key: string;
  value: string | number;
};

export abstract class QuerierClient {
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
