/**
 * Describe success handler - CREATE sets progressMessageId, UPDATE finishes with embed description
 */

import { MessageHandler } from './messageHandler.js';
import { MessageType } from '../../constants.js';
import { TaskAction } from '../../constants.js';
import { TaskStatus } from '../../constants.js';
import {
  TASK_PROPERTY_PROGRESS_MESSAGE_ID,
  TASK_PROPERTY_FINAL_PROMPT,
  TASK_PROPERTY_MESSAGE_ID,
  TASK_PROPERTY_BUTTONS,
  MJ_MESSAGE_HANDLED,
} from '../../constants.js';
import { TaskCondition } from '../../support/taskCondition.js';
import { extractButtonsFromMessage } from '../../utils/buttonUtils.js';

export class DescribeSuccessHandler extends MessageHandler {
  order() {
    return 10;
  }

  handle(instance, messageType, message, eventType) {
    const messageId = message.id;
    if (messageType === MessageType.CREATE) {
      if (this.getInteractionName(message) !== 'describe') return;
      message[MJ_MESSAGE_HANDLED] = true;
      const nonce = this.getMessageNonce(message);
      const task = instance.getRunningTaskByNonce(nonce);
      if (!task) return;
      task.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, messageId);
    } else if (messageType === MessageType.UPDATE) {
      this.finishDescribeTask(instance, message, messageId);
    }
  }

  finishDescribeTask(instance, message, progressMessageId) {
    const embeds = message?.embeds;
    if (!progressMessageId || !embeds?.length) return;
    const condition = new TaskCondition()
      .setActionSet(new Set([TaskAction.DESCRIBE]))
      .setProgressMessageId(progressMessageId);
    let task = instance.findRunningTask(condition.toFunction()).find((t) => t) || null;
    if (!task) {
      const nonce = this.getMessageNonce(message);
      if (nonce) {
        const nonceTask = instance.getRunningTaskByNonce(nonce);
        if (nonceTask?.action === TaskAction.DESCRIBE && (nonceTask.status === TaskStatus.IN_PROGRESS || nonceTask.status === TaskStatus.SUBMITTED)) {
          task = nonceTask;
          task.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, progressMessageId);
        }
      }
      if (!task) {
        const actionStatusCondition = new TaskCondition()
          .setActionSet(new Set([TaskAction.DESCRIBE]))
          .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]));
        const matching = instance.findRunningTask(actionStatusCondition.toFunction());
        if (matching.length > 0) {
          task = matching.sort((a, b) => (b.startTime || 0) - (a.startTime || 0))[0];
          task.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, progressMessageId);
        }
      }
    }
    if (!task || task.action !== TaskAction.DESCRIBE) return;
    const buttons = extractButtonsFromMessage(message);
    message[MJ_MESSAGE_HANDLED] = true;
    const description = embeds[0].description;
    task.prompt = description;
    task.promptEn = description;
    task.setProperty(TASK_PROPERTY_FINAL_PROMPT, description);
    if (embeds[0].image?.url) {
      task.imageUrl = this.replaceCdnUrl(embeds[0].image.url);
    }
    this.finishTask(instance, task, message);
    if (message.id && buttons?.length > 0) {
      const cond = new TaskCondition()
        .setActionSet(new Set([TaskAction.DESCRIBE]))
        .setStatusSet(new Set([TaskStatus.SUCCESS]));
      const finished = instance.findRunningTask(cond.toFunction()).find((t) => t.getProperty(TASK_PROPERTY_MESSAGE_ID) === message.id) || null;
      if (finished) finished.setProperty(TASK_PROPERTY_BUTTONS, buttons);
    }
  }
}
