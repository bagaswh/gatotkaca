import { Logger } from 'winston';
import { createLogger } from './logger';

export class Scheduler {
  private static instance: Scheduler;
  private logger: Logger;

  private readonly intervalIds: {
    [key: string]: {
      name: string;
      intervalId: NodeJS.Timer;
    };
  };

  private constructor() {
    this.intervalIds = {};
    this.logger = createLogger({
      component: 'Scheduler',
    });
  }

  static getInstance() {
    if (!Scheduler.instance) {
      Scheduler.instance = new Scheduler();
    }
    return Scheduler.instance;
  }

  private handle(
    id: string,
    name: string,
    interval: number,
    handler: (id: string, name: string) => Promise<void> | void
  ) {
    this.intervalIds[id] = {
      name,
      intervalId: setTimeout(async () => {
        try {
          await handler(id, name);
        } catch (err) {
          this.logger.error(
            `failed executing handler function for schedule ${id}:${name}`
          );
        } finally {
          this.handle(id, name, interval, handler);
        }
      }, interval),
    };
  }

  register(
    id: string,
    name: string,
    interval: number,
    handler: (id: string, name: string) => void
  ) {
    if (id in this.intervalIds) {
      throw new Error(`Schedule id ${id} already exists`);
    }
    this.handle(id, name, interval, handler);
  }
}
