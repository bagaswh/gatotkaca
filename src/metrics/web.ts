import express, { Express } from 'express';
import http from 'http';
import { Config } from '../config';
import { createLogger } from '../logger';
import { MetricsStorage } from './metrics';

export class WebServer {
  private readonly app: Express;

  constructor(
    private readonly metricsStorage: MetricsStorage,
    private readonly cfg: Config
  ) {
    this.app = express();
    this.setup();
  }

  setup() {
    this.app.get(this.cfg.web.metricsPath, async (req, res) => {
      res
        .setHeader('content-type', 'text/plain')
        .send(await this.metricsStorage.render());
    });

    this.app.get('/-/ready', (req, res) => {});
  }

  start() {
    http
      .createServer(this.app)
      .listen(this.cfg.web.port, this.cfg.web.hostname, () => {
        createLogger('web', this.cfg.logLevel).info(
          `Started HTTP server on ${this.cfg.web.hostname}:${this.cfg.web.port}`
        );
      });
  }
}
