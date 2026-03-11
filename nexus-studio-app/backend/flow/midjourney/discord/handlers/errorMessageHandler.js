/**
 * Error message handler - Failed... or embed with red color
 */

import { MessageHandler } from './messageHandler.js';
import { MessageType } from '../../constants.js';
import { TaskStatus } from '../../constants.js';
import { TASK_PROPERTY_PROGRESS_MESSAGE_ID, MJ_MESSAGE_HANDLED } from '../../constants.js';
import { TaskCondition } from '../../support/taskCondition.js';

export class ErrorMessageHandler extends MessageHandler {
  order() {
    return 2;
  }

  handle(instance, messageType, message, eventType) {
    const content = this.getMessageContent(message);
    if (content.startsWith('Failed')) {
      message[MJ_MESSAGE_HANDLED] = true;
      const nonce = this.getMessageNonce(message);
      const task = instance.getRunningTaskByNonce(nonce);
      if (task) task.fail(content);
      return;
    }
    const embeds = message?.embeds;
    if (!embeds?.length) return;
    const embed = embeds[0];
    const title = embed.title || '';
    if (!title) return;
    const description = embed.description || '';
    const footerText = embed.footer?.text || '';
    const color = embed.color ?? 0;
    if (color === 16239475) {
      console.warn(`${instance.getInstanceId()} - MJ warning: ${title}\n${description}\nfooter: ${footerText}`);
    } else if (color === 16711680) {
      message[MJ_MESSAGE_HANDLED] = true;
      console.error(`${instance.getInstanceId()} - MJ error: ${title}\n${description}\nfooter: ${footerText}`);
      const nonce = this.getMessageNonce(message);
      let task = nonce ? instance.getRunningTaskByNonce(nonce) : this.findTaskWhenError(instance, messageType, message);
      if (task) task.fail(`[${title}] ${description}`);
    } else {
      if (embed.type === 'link' || !description) return;
      const task = this.findTaskWhenError(instance, messageType, message);
      if (task) {
        message[MJ_MESSAGE_HANDLED] = true;
        console.warn(`${instance.getInstanceId()} - MJ possible error: ${title}\n${description}\nfooter: ${footerText}`);
        task.fail(`[${title}] ${description}`);
      }
    }
  }

  findTaskWhenError(instance, messageType, message) {
    let progressMessageId;
    if (messageType === MessageType.CREATE) {
      progressMessageId = this.getReferenceMessageId(message);
    } else if (messageType === MessageType.UPDATE) {
      progressMessageId = message.id;
    }
    if (!progressMessageId) return null;
    const condition = new TaskCondition()
      .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
      .setProgressMessageId(progressMessageId);
    return instance.findRunningTask(condition.toFunction()).find((t) => t) || null;
  }
}
