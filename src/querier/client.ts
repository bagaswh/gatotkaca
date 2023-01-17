export type QueryResult = {
  key: string;
  value: string | number;
};

export default abstract class QuerierClient {
  abstract query(key: string): Promise<QueryResult>;
}
