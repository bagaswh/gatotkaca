import EventEmitter from 'events';
import { ValueError } from '../error';
import { nanoid } from 'nanoid';

export class Scheduler extends EventEmitter {
  private static instance: Scheduler | null = null;

  private readonly intervalIds: {
    id: string;
    name: string;
    intervalId: NodeJS.Timer;
  }[];

  private constructor() {
    super();
    this.intervalIds = [];
  }

  static getInstance() {
    if (Scheduler.instance === null) {
      Scheduler.instance = new Scheduler();
    }
    return Scheduler.instance;
  }

  register(id: string, name: string, interval: number) {
    // disallow less than a minute interval
    if (interval < 60000) {
      throw new ValueError(
        'scheduler interval cannot be less than a minute (60000ms)'
      );
    }

    this.intervalIds.push({
      id,
      name,
      intervalId: setInterval(() => {
        this.emit('interval', { id, name });
      }, interval),
    });
  }
}
