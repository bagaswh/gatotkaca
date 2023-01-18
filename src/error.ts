export class GatotError extends Error {
  constructor(message: string, private readonly originalError?: Error) {
    super(message);
  }
}

export class ValueError extends Error {}
