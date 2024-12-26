import { GatotError } from '../../error';

export class ClientError extends GatotError {}
export class ClientInitError extends ClientError {}
export class ClientQueryError extends ClientError {}
