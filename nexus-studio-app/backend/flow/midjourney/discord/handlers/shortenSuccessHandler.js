/**
 * Shorten success handler
 */

import { MessageHandler } from './messageHandler.js';
import { MessageType } from '../../constants.js';
import { TaskAction } from '../../constants.js';
import {
  TASK_PROPERTY_PROGRESS_MESSAGE_ID,
  TASK_PROPERTY_FINAL_PROMPT,
  MJ_MESSAGE_HANDLED,
} from '../../constants.js';
import { TaskCondition } from '../../support/taskCondition.js';

export class ShortenSuccessHandler extends MessageHandler {
  order() {
    return 10;
  }

  handle(instance, messageType, message, eventType) {
    const messageId = message.id;
    if (messageType === MessageType.CREATE) {
      if (this.getInteractionName(message) !== 'shorten') return;
      message[MJ_MESSAGE_HANDLED] = true;
      const nonce = this.getMessageNonce(message);
      const task = instance.getRunningTaskByNonce(nonce);
      if (!task) return;
      task.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, messageId);
    } else if (messageType === MessageType.UPDATE) {
      this.finishShortenTask(instance, message, messageId);
    }
  }

  finishShortenTask(instance, message, progressMessageId) {
    const embeds = message?.embeds;
    if (!progressMessageId || !embeds?.length) return;
    const condition = new TaskCondition()
      .setActionSet(new Set([TaskAction.SHORTEN]))
      .setProgressMessageId(progressMessageId);
    const task = instance.findRunningTask(condition.toFunction()).find((t) => t) || null;
    if (!task) return;
    message[MJ_MESSAGE_HANDLED] = true;
    const description = embeds[0].description;
    task.prompt = description;
    task.promptEn = description;
    task.setProperty(TASK_PROPERTY_FINAL_PROMPT, description);
    if (embeds[0].image?.url) {
      task.imageUrl = this.replaceCdnUrl(embeds[0].image.url);
    }
    this.finishTask(instance, task, message);
  }
}
