/**
 * Start and progress handler
 */

import { MessageHandler } from './messageHandler.js';
import { MessageType } from '../../constants.js';
import { TaskStatus } from '../../constants.js';
import {
  TASK_PROPERTY_PROGRESS_MESSAGE_ID,
  TASK_PROPERTY_FINAL_PROMPT,
  TASK_PROPERTY_MESSAGE_HASH,
  MJ_MESSAGE_HANDLED,
} from '../../constants.js';
import { TaskCondition } from '../../support/taskCondition.js';
import { parseContent } from '../../utils/convertUtils.js';

export class StartAndProgressHandler extends MessageHandler {
  order() {
    return 90;
  }

  handle(instance, messageType, message, eventType) {
    const nonce = this.getMessageNonce(message);
    const content = this.getMessageContent(message);
    const parseData = parseContent(content);

    if (messageType === MessageType.CREATE && nonce) {
      const task = instance.getRunningTaskByNonce(nonce);
      if (!task) return;
      message[MJ_MESSAGE_HANDLED] = true;
      task.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, message.id);
      if (parseData) task.setProperty(TASK_PROPERTY_FINAL_PROMPT, parseData.prompt);
      task.status = TaskStatus.IN_PROGRESS;
    } else if (messageType === MessageType.UPDATE && parseData) {
      if (parseData.status === 'Stopped') return;
      const condition = new TaskCondition()
        .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
        .setProgressMessageId(message.id);
      const task = instance.findRunningTask(condition.toFunction()).find((t) => t) || null;
      if (!task) return;
      message[MJ_MESSAGE_HANDLED] = true;
      task.setProperty(TASK_PROPERTY_FINAL_PROMPT, parseData.prompt);
      task.status = TaskStatus.IN_PROGRESS;
      task.progress = parseData.status;
      const imageUrl = this.getImageUrl(message);
      if (imageUrl) {
        task.imageUrl = imageUrl;
        const messageHash = this.discordHelper.getMessageHash(imageUrl);
        if (messageHash) task.setProperty(TASK_PROPERTY_MESSAGE_HASH, messageHash);
      }
    }
  }
}
