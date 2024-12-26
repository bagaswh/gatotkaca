import express, { Express } from 'express';
import http from 'http';
import app from '../app';
import { Config } from '../config';
import { GatotError } from '../error';
import { createLogger } from '../logger';
import metricsStorageManager from './manager';
import { MetricsStorage } from './metrics';

export class WebServerError extends GatotError {}

export class WebServer {
  private readonly app: Express;
  private readonly metricsStorage: MetricsStorage;

  constructor(private readonly cfg: Config) {
    this.app = express();
    this.setup();

    const metricsStorage = metricsStorageManager.getStorage(
      cfg.web.renderMetricsFromStorage
    );
    if (!metricsStorage) {
      throw new WebServerError(
        `Invalid storage '${cfg.web.renderMetricsFromStorage}' as the storage is not available. You may need to define the storage first.`
      );
    }
    this.metricsStorage = metricsStorage.storage;
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
        createLogger('web', app.config().logLevel).info(
          `Started HTTP server on ${this.cfg.web.hostname}:${this.cfg.web.port}`
        );
      });
  }
}
