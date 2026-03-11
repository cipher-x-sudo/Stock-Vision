/**
 * Midjourney module bootstrap - config, store, Discord (HTTP + Gateway), load balancer, task service, controllers, routes
 */

import config from './config.js';
import { InMemoryTaskStoreService } from './store/index.js';
import { DiscordHelper } from './discord/DiscordHelper.js';
import { DiscordService } from './discord/DiscordService.js';
import { DiscordGateway } from './discord/DiscordGateway.js';
import { UserMessageListener } from './discord/UserMessageListener.js';
import { createMessageHandlers } from './discord/handlers/index.js';
import { DiscordInstance } from './loadbalancer/DiscordInstance.js';
import { DiscordLoadBalancer } from './loadbalancer/DiscordLoadBalancer.js';
import { RoundRobinRule } from './loadbalancer/rules/roundRobinRule.js';
import { TaskService } from './services/TaskService.js';
import { SubmitController } from './controllers/SubmitController.js';
import { TaskController } from './controllers/TaskController.js';
import { registerRoutes } from './routes.js';

function toAccountObj(acc) {
  const obj = { ...acc };
  obj.getDisplay = function () {
    return this.channelId || '';
  };
  return obj;
}

/**
 * Register Midjourney routes and start Gateway connections.
 * @param {import('express').Express} app - Express app
 */
export function registerMidjourney(app) {
  const accounts = (config.accounts || []).map(toAccountObj);
  const log = (msg) => (app.state?._log?.(msg) ?? console.log(msg));
  if (accounts.length === 0) {
    log('[MJ] No Discord accounts configured (MJ_DISCORD_CHANNEL_ID, MJ_DISCORD_USER_TOKEN). MJ routes will return 503 for submit.');
  }

  const timeoutMs = parseTimeout(config.taskStore?.timeout || '30d');
  const taskStoreService = new InMemoryTaskStoreService(timeoutMs);
  const discordHelper = new DiscordHelper({ ngDiscord: config.ngDiscord || {} });
  const rule = new RoundRobinRule();
  const loadBalancer = new DiscordLoadBalancer(rule);

  for (const acc of accounts) {
    const discordService = new DiscordService(acc, null, discordHelper);
    const handlers = createMessageHandlers(discordHelper);
    const userMessageListener = new UserMessageListener(handlers);
    const wssServer = discordHelper.getWss();
    const resumeWss = discordHelper.getResumeWss();

    const onSuccess = (sessionId) => {
      discordService.setSessionId(sessionId);
    };
    const onFailure = (code, reason) => {
      if (typeof console?.warn === 'function') {
        console.warn(`[MJ Gateway ${acc.channelId}] closed: ${code} ${reason}`);
      }
    };

    const gateway = new DiscordGateway(
      acc,
      userMessageListener,
      discordHelper,
      wssServer,
      resumeWss,
      onSuccess,
      onFailure
    );

    const instance = new DiscordInstance(acc, taskStoreService, discordService, gateway);
    userMessageListener.setInstance(instance);
    discordService.setSessionIdGetter(() => gateway.getConnectionStatus?.()?.sessionId ?? null);
    loadBalancer.addInstance(instance);

    gateway.start().catch((err) => {
      if (typeof console?.error === 'function') {
        console.error(`[MJ Gateway ${acc.channelId}] start error:`, err?.message);
      }
    });
  }

  const taskService = new TaskService(taskStoreService, loadBalancer);
  const submitController = new SubmitController(taskService, taskStoreService);
  const taskController = new TaskController(taskStoreService, loadBalancer);
  registerRoutes(app, submitController, taskController);
}

function parseTimeout(str) {
  if (typeof str === 'number' && str > 0) return str;
  const s = String(str || '30d').trim();
  const match = s.match(/^(\d+)(d|h|m|s|ms)?$/i);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const num = parseInt(match[1], 10);
  const unit = (match[2] || 'd').toLowerCase();
  if (unit === 'd') return num * 24 * 60 * 60 * 1000;
  if (unit === 'h') return num * 60 * 60 * 1000;
  if (unit === 'm') return num * 60 * 1000;
  if (unit === 's') return num * 1000;
  return num;
}
