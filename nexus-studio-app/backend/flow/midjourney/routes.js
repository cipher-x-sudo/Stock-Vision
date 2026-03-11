/**
 * Register all /api/mj routes on Express app
 */

export function registerRoutes(app, submitController, taskController) {
  const log = (msg) => (app.state?._log?.(msg) ?? console.log(msg));

  app.get('/api/flow/mj/status', (req, res) => {
    const configured = (submitController.taskService.discordLoadBalancer.getAliveInstances?.() ?? []).length > 0;
    res.json({
      configured,
      server: configured ? 'local' : null,
    });
  });

  app.post('/api/flow/mj/submit/imagine', (req, res, next) => {
    submitController.imagine(req, res).catch(next);
  });
  app.post('/api/flow/mj/submit/action', (req, res, next) => {
    submitController.action(req, res).catch(next);
  });
  app.post('/api/flow/mj/submit/modal', (req, res, next) => {
    submitController.modal(req, res).catch(next);
  });
  app.post('/api/flow/mj/submit/change', (req, res, next) => {
    submitController.change(req, res).catch(next);
  });
  app.post('/api/flow/mj/submit/edits', (req, res, next) => {
    submitController.edits(req, res).catch(next);
  });
  app.post('/api/flow/mj/submit/describe', (req, res, next) => {
    submitController.describe(req, res).catch(next);
  });
  app.post('/api/flow/mj/submit/blend', (req, res, next) => {
    submitController.blend(req, res).catch(next);
  });
  app.post('/api/flow/mj/submit/shorten', (req, res, next) => {
    submitController.shorten(req, res).catch(next);
  });
  app.post('/api/flow/mj/submit/upload-discord-images', (req, res, next) => {
    submitController.uploadDiscordImages(req, res).catch(next);
  });

  app.get('/api/flow/mj/task/:taskId/fetch', (req, res, next) => {
    taskController.fetch(req, res).catch(next);
  });
  app.post('/api/flow/mj/task/list-by-condition', (req, res, next) => {
    taskController.listByCondition(req, res).catch(next);
  });
  app.get('/api/flow/mj/task/queue', (req, res, next) => {
    taskController.queue(req, res).catch(next);
  });

  app.post('/api/flow/mj/insight-face/swap', (req, res) => {
    res.status(501).json({
      code: 501,
      description: 'Face swap not implemented in standalone server',
      error: 'Not implemented',
    });
  });

  log('[MJ] Midjourney routes registered (standalone)');
}
