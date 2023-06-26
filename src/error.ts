export class GatotError extends Error {
  constructor(message: string, private readonly originalError?: Error) {
    super(message);
  }
}

export class NotImplementedError extends GatotError {}
