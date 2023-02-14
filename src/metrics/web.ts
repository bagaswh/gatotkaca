import express from 'express';
import http from 'http';
import { Config, WebConfig } from '../config';
import { createLogger } from '../logger';
import { MetricsStorage } from './metrics';

export function initWeb(cfg: Config, metricsStorage: MetricsStorage) {
  const app = express();

  app.get(cfg.web.metricsPath, async (req, res) => {
    res
      .setHeader('content-type', 'text/plain')
      .send(await metricsStorage.render());
  });

  http.createServer(app).listen(cfg.web.port, cfg.web.hostname, () => {
    createLogger('web', cfg.logLevel).info(
      `Started HTTP server on ${cfg.web.hostname}:${cfg.web.port}`
    );
  });
}
