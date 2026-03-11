/**
 * Base message handler - getMessageContent, getMessageNonce, findAndFinishImageTask, finishTask, getImageUrl
 */

import { MessageType } from '../../constants.js';
import { TaskAction } from '../../constants.js';
import { TaskStatus } from '../../constants.js';
import {
  TASK_PROPERTY_FINAL_PROMPT,
  TASK_PROPERTY_MESSAGE_ID,
  TASK_PROPERTY_MESSAGE_HASH,
  TASK_PROPERTY_FLAGS,
  MJ_MESSAGE_HANDLED,
} from '../../constants.js';
import { TaskCondition } from '../../support/taskCondition.js';
import { getPrimaryPrompt } from '../../utils/convertUtils.js';

export class MessageHandler {
  constructor(discordHelper) {
    this.discordHelper = discordHelper;
  }

  order() {
    return 100;
  }

  /**
   * @param {import('../../loadbalancer/DiscordInstance.js').DiscordInstance} instance
   * @param {string} messageType - MessageType.CREATE | UPDATE | DELETE
   * @param {object} message - Discord message/event data
   * @param {string} [eventType] - Raw event type e.g. MESSAGE_UPDATE
   */
  handle(instance, messageType, message, eventType) {}

  getMessageContent(message) {
    return message?.content || '';
  }

  getMessageNonce(message) {
    return message?.nonce || '';
  }

  getInteractionName(message) {
    return message?.interaction?.name || '';
  }

  getReferenceMessageId(message) {
    return message?.message_reference?.message_id || '';
  }

  findAndFinishImageTask(instance, action, finalPrompt, message) {
    if (!finalPrompt) return;
    const imageUrl = this.getImageUrl(message);
    const messageHash = imageUrl ? this.discordHelper.getMessageHash(imageUrl) : null;
    const condition = new TaskCondition()
      .setActionSet(new Set([action]))
      .setFinalPrompt(finalPrompt)
      .setStatusSet(new Set([TaskStatus.IN_PROGRESS]));

    if (messageHash) condition.setMessageHash(messageHash);

    let task = instance.findRunningTask(condition.toFunction()).find((t) => t) || null;
    if (!task) {
      condition.setMessageHash(undefined);
      const tasks = instance.findRunningTask(condition.toFunction());
      task = tasks.sort((a, b) => (a.startTime || 0) - (b.startTime || 0))[0] || null;
    }
    if (!task && action !== TaskAction.BLEND) {
      condition.setFinalPrompt(undefined);
      condition.setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]));
      const matchPrompt = getPrimaryPrompt(finalPrompt).replace(/\s+/g, '');
      const tasks = instance.findRunningTask(condition.toFunction());
      task = tasks
        .filter((t) => {
          const taskPrompt = t.promptEn || '';
          return matchPrompt === getPrimaryPrompt(taskPrompt).replace(/\s+/g, '');
        })
        .sort((a, b) => (a.startTime || 0) - (b.startTime || 0))[0] || null;
    }
    if (!task) return;
    message[MJ_MESSAGE_HANDLED] = true;
    task.setProperty(TASK_PROPERTY_FINAL_PROMPT, finalPrompt);
    if (messageHash) task.setProperty(TASK_PROPERTY_MESSAGE_HASH, messageHash);
    if (imageUrl) task.imageUrl = imageUrl;
    this.finishTask(instance, task, message);
  }

  finishTask(instance, task, message) {
    if (message?.id) task.setProperty(TASK_PROPERTY_MESSAGE_ID, message.id);
    task.setProperty(TASK_PROPERTY_FLAGS, message?.flags || 0);
    if (task.imageUrl) {
      const messageHash = this.discordHelper.getMessageHash(task.imageUrl);
      if (messageHash) task.setProperty(TASK_PROPERTY_MESSAGE_HASH, messageHash);
    }
    task.success();
  }

  hasImage(message) {
    return message?.attachments && message.attachments.length > 0;
  }

  getImageUrl(message) {
    if (!message?.attachments?.length) return null;
    const imageUrl = message.attachments[0].url;
    return this.replaceCdnUrl(imageUrl);
  }

  replaceCdnUrl(imageUrl) {
    if (!imageUrl) return imageUrl;
    const cdn = this.discordHelper.getCdn();
    if (imageUrl.startsWith(cdn)) return imageUrl;
    const DISCORD_CDN_URL = 'https://cdn.discordapp.com';
    return imageUrl.replace(DISCORD_CDN_URL, cdn);
  }
}
