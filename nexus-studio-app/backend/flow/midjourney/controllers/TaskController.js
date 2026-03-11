/**
 * Task controller - fetch, list-by-condition, queue
 */

import { ReturnCode } from '../constants.js';

export class TaskController {
  constructor(taskStoreService, discordLoadBalancer) {
    this.taskStoreService = taskStoreService;
    this.discordLoadBalancer = discordLoadBalancer;
  }

  fetch(req, res) {
    const taskId = req.params?.taskId?.trim?.();
    if (!taskId) {
      res.status(400).json({ code: ReturnCode.VALIDATION_ERROR, description: 'taskId is required' });
      return;
    }
    const task = this.taskStoreService.get(taskId);
    if (!task) {
      res.status(404).json({ code: ReturnCode.NOT_FOUND, description: 'task does not exist or has expired' });
      return;
    }
    res.json(task.toJSON());
  }

  async listByCondition(req, res) {
    const body = req.body || {};
    const ids = body.ids;
    let tasks;
    if (Array.isArray(ids) && ids.length > 0) {
      const idSet = new Set(ids.map((id) => String(id).trim()).filter(Boolean));
      tasks = this.taskStoreService.list((task) => idSet.has(task.id));
    } else {
      tasks = this.taskStoreService.list();
    }
    res.json(tasks.map((t) => t.toJSON()));
  }

  queue(req, res) {
    const queueTasks = this.discordLoadBalancer.getQueueTasks();
    res.json(queueTasks.map((t) => t.toJSON()));
  }
}
