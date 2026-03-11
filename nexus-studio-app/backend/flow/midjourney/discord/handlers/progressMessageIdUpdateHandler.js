/**
 * Progress Message ID Update - match MESSAGE_UPDATE to task by nonce/prompt when progressMessageId differs
 */

import { MessageHandler } from './messageHandler.js';
import { MessageType } from '../../constants.js';
import { TaskStatus } from '../../constants.js';
import {
  TASK_PROPERTY_PROGRESS_MESSAGE_ID,
  TASK_PROPERTY_FINAL_PROMPT,
  TASK_PROPERTY_DISCORD_INSTANCE_ID,
  MJ_MESSAGE_HANDLED,
} from '../../constants.js';
import { TaskCondition } from '../../support/taskCondition.js';
import { parseContent } from '../../utils/convertUtils.js';

export class ProgressMessageIdUpdateHandler extends MessageHandler {
  order() {
    return 85;
  }

  handle(instance, messageType, message, eventType) {
    if (messageType !== MessageType.UPDATE) return;
    const content = this.getMessageContent(message);
    const parseData = parseContent(content);
    if (!parseData || parseData.status === 'Stopped') return;
    if (message[MJ_MESSAGE_HANDLED] === true) return;

    const condition = new TaskCondition()
      .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
      .setProgressMessageId(message.id);
    let task = instance.findRunningTask(condition.toFunction()).find((t) => t) || null;
    if (task) return;

    const nonce = this.getMessageNonce(message);
    if (nonce) {
      const nonceTask = instance.getRunningTaskByNonce(nonce);
      if (nonceTask && (nonceTask.status === TaskStatus.IN_PROGRESS || nonceTask.status === TaskStatus.SUBMITTED)) {
        nonceTask.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, message.id);
        return;
      }
    }

    if (parseData.prompt) {
      const instanceId = instance.getInstanceId();
      const promptTasks = instance.findRunningTask((t) => {
        const finalPrompt = t.getProperty(TASK_PROPERTY_FINAL_PROMPT);
        const status = t.status;
        const taskInstanceId = t.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
        return finalPrompt === parseData.prompt && (status === TaskStatus.IN_PROGRESS || status === TaskStatus.SUBMITTED) && taskInstanceId === instanceId;
      });
      if (promptTasks.length > 0) {
        const sorted = promptTasks.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
        sorted[0].setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, message.id);
        return;
      }
    }

    const instanceId = instance.getInstanceId();
    const statusTasks = instance.findRunningTask((t) => {
      const status = t.status;
      const taskInstanceId = t.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
      const hasProgressMessageId = t.getProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID);
      return (status === TaskStatus.IN_PROGRESS || status === TaskStatus.SUBMITTED) && taskInstanceId === instanceId && !hasProgressMessageId;
    });
    if (statusTasks.length > 0) {
      const sorted = statusTasks.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
      sorted[0].setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, message.id);
    }
  }
}
