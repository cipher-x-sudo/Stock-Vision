/**
 * Single Discord account instance - queue, running tasks, submitTask, delegate to DiscordService
 */

import { ReturnCode } from '../constants.js';
import { TaskStatus } from '../constants.js';
import { TASK_PROPERTY_DISCORD_INSTANCE_ID } from '../constants.js';
import { SubmitResultVO } from '../models/SubmitResultVO.js';
import { Message } from '../result/Message.js';
import { getBlendDimensionsValue } from '../constants.js';

export class DiscordInstance {
  constructor(account, taskStoreService, discordService, gateway = null) {
    this.accountData = account;
    this.taskStoreService = taskStoreService;
    this.discordService = discordService;
    this.gateway = gateway;
    this.runningTasks = [];
    this.queueTasks = [];
    this.taskFutureMap = new Map();
    this.concurrency = account.coreSize || 3;
    this.running = 0;
    this.queue = [];
  }

  getInstanceId() {
    return this.accountData.channelId || '';
  }

  account() {
    return this.accountData;
  }

  isAlive() {
    return this.accountData.enable !== false;
  }

  getRunningTasks() {
    return [...this.runningTasks];
  }

  getQueueTasks() {
    return [...this.queueTasks];
  }

  getRunningFutures() {
    return new Map(this.taskFutureMap);
  }

  findRunningTask(condition) {
    const fn = typeof condition === 'function' ? condition : (t) => condition.test(t);
    return this.runningTasks.filter(fn);
  }

  getRunningTask(id) {
    return this.runningTasks.find((t) => t.id === id);
  }

  getRunningTaskByNonce(nonce) {
    return this.runningTasks.find((t) => t.getProperty('nonce') === nonce);
  }

  addRunningTask(task) {
    if (task && task.id && !this.runningTasks.find((t) => t.id === task.id)) {
      this.runningTasks.push(task);
    }
  }

  exitTask(task) {
    this.taskFutureMap.delete(task.id);
    this.saveAndNotify(task).catch(() => {});
    const ri = this.runningTasks.findIndex((t) => t.id === task.id);
    if (ri >= 0) this.runningTasks.splice(ri, 1);
    const qi = this.queueTasks.findIndex((t) => t.id === task.id);
    if (qi >= 0) this.queueTasks.splice(qi, 1);
  }

  async saveAndNotify(task) {
    if (!task || !task.id) return;
    this.taskStoreService.save(task);
  }

  async submitTask(task, discordSubmit) {
    if (!task || !task.id) {
      return SubmitResultVO.fail(ReturnCode.FAILURE, 'Task ID is missing');
    }
    task.setProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID, this.getInstanceId());
    await this.saveAndNotify(task);
    const currentWait = this.queueTasks.length;
    this.queueTasks.push(task);
    const promise = this._runQueue(() => this.executeTask(task, discordSubmit));
    this.taskFutureMap.set(task.id, promise);
    if (currentWait === 0) {
      return SubmitResultVO.of(ReturnCode.SUCCESS, 'Submission successful', task.id).setProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID, this.getInstanceId());
    }
    return SubmitResultVO.of(ReturnCode.IN_QUEUE, `In queue, ${currentWait} tasks ahead`, task.id)
      .setProperty('numberOfQueues', currentWait)
      .setProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID, this.getInstanceId());
  }

  _runQueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._processQueue();
    });
  }

  _processQueue() {
    if (this.running >= this.concurrency || this.queue.length === 0) return;
    this.running++;
    const item = this.queue.shift();
    item.fn()
      .then(item.resolve)
      .catch(item.reject)
      .finally(() => {
        this.running--;
        this._processQueue();
      });
  }

  async executeTask(task, discordSubmit) {
    this.runningTasks.push(task);
    try {
      const result = await discordSubmit();
      task.startTime = Date.now();
      if (result.getCode() !== ReturnCode.SUCCESS) {
        task.fail(result.getDescription());
        await this.saveAndNotify(task);
        return;
      }
      task.status = TaskStatus.SUBMITTED;
      task.progress = '0%';
      await this.saveAndNotify(task);
      const waiting = new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]);
      while (waiting.has(task.status)) {
        await new Promise((r) => setTimeout(r, 100));
        await this.saveAndNotify(task);
      }
    } catch (err) {
      task.fail(`[Internal Server Error] ${err.message || err}`);
      await this.saveAndNotify(task);
    } finally {
      const ri = this.runningTasks.findIndex((t) => t.id === task.id);
      if (ri >= 0) this.runningTasks.splice(ri, 1);
      const qi = this.queueTasks.findIndex((t) => t.id === task.id);
      if (qi >= 0) this.queueTasks.splice(qi, 1);
      this.taskFutureMap.delete(task.id);
    }
  }

  async imagine(prompt, nonce) {
    return this.discordService.imagine(prompt, nonce);
  }

  async upscale(messageId, index, messageHash, messageFlags, nonce) {
    return this.discordService.upscale(messageId, index, messageHash, messageFlags, nonce);
  }

  async variation(messageId, index, messageHash, messageFlags, nonce) {
    return this.discordService.variation(messageId, index, messageHash, messageFlags, nonce);
  }

  async reroll(messageId, messageHash, messageFlags, nonce) {
    return this.discordService.reroll(messageId, messageHash, messageFlags, nonce);
  }

  async describe(finalFileName, nonce) {
    return this.discordService.describe(finalFileName, nonce);
  }

  async shorten(prompt, nonce) {
    return this.discordService.shorten(prompt, nonce);
  }

  async blend(finalFileNames, dimensions, nonce) {
    return this.discordService.blend(finalFileNames, dimensions, nonce);
  }

  async upload(fileName, dataUrl) {
    return this.discordService.upload(fileName, dataUrl);
  }

  async sendImageMessage(content, finalFileName) {
    return this.discordService.sendImageMessage(content, finalFileName);
  }

  async customAction(messageId, messageFlags, customId, nonce) {
    return this.discordService.customAction(messageId, messageFlags, customId, nonce);
  }

  async modalSubmit(taskId, fields, nonce) {
    return this.discordService.modalSubmit(taskId, fields, nonce);
  }

  async edits(messageId, customId, nonce) {
    return this.discordService.edits(messageId, customId, nonce);
  }

  async fetchMessage(messageId) {
    return this.discordService.fetchMessage(messageId);
  }

  getConnectionStatus() {
    if (!this.gateway) {
      return { connected: false, running: false, sessionId: null, sequence: null, websocketState: 'none', hasSession: false };
    }
    return this.gateway.getConnectionStatus ? this.gateway.getConnectionStatus() : { connected: false, running: false, sessionId: null, sequence: null, websocketState: 'unknown', hasSession: false };
  }
}
