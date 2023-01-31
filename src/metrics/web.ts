import express from 'express';
import http from 'http';
import { WebConfig } from '../config';
import { createLogger } from '../logger';
import { MetricsStorage } from './metrics';

export function initWeb(cfg: WebConfig, metricsStorage: MetricsStorage) {
  const app = express();

  app.get(cfg.metricsPath, async (req, res) => {
    res
      .setHeader('content-type', 'text/plain')
      .send(await metricsStorage.render());
  });

  http.createServer(app).listen(cfg.port, cfg.hostname, () => {
    createLogger({ component: 'web' }).info(
      `Started HTTP server on ${cfg.hostname}:${cfg.port}`
    );
  });
}
