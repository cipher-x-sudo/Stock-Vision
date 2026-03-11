/**
 * Upscale success handler - Upscaled by / Image #N
 */

import { MessageHandler } from './messageHandler.js';
import { MessageType } from '../../constants.js';
import { TaskAction } from '../../constants.js';
import { TaskStatus } from '../../constants.js';
import {
  TASK_PROPERTY_REFERENCED_MESSAGE_ID,
  TASK_PROPERTY_FINAL_PROMPT,
  TASK_PROPERTY_MESSAGE_HASH,
  TASK_PROPERTY_MESSAGE_ID,
  TASK_PROPERTY_BUTTONS,
  MJ_MESSAGE_HANDLED,
} from '../../constants.js';
import { TaskCondition } from '../../support/taskCondition.js';
import { parseContentWithRegex } from '../../utils/convertUtils.js';
import { extractButtonsFromMessage } from '../../utils/buttonUtils.js';

const CONTENT_REGEX_1 = '\\*\\*(.*)\\*\\* - Upscaled \\(.*?\\) by <@\\d+> \\((.*?)\\)';
const CONTENT_REGEX_2 = '\\*\\*(.*)\\*\\* - Upscaled by <@\\d+> \\((.*?)\\)';
const CONTENT_REGEX_U = '\\*\\*(.*)\\*\\* - Image #(\\d) <@\\d+>';

export class UpscaleSuccessHandler extends MessageHandler {
  order() {
    return 102;
  }

  handle(instance, messageType, message, eventType) {
    const content = this.getMessageContent(message);
    const parseData = this.getParseData(content);
    if (messageType !== MessageType.CREATE || !parseData || !this.hasImage(message)) return;
    if (parseData.index != null) {
      this.findAndFinishUTask(instance, parseData.prompt, parseData.index, message);
    } else {
      const buttons = extractButtonsFromMessage(message);
      this.findAndFinishImageTask(instance, TaskAction.UPSCALE, parseData.prompt, message);
      if (message.id && buttons?.length > 0) {
        const condition = new TaskCondition()
          .setActionSet(new Set([TaskAction.UPSCALE]))
          .setStatusSet(new Set([TaskStatus.SUCCESS]));
        const task = instance.findRunningTask(condition.toFunction()).find((t) => t.getProperty(TASK_PROPERTY_MESSAGE_ID) === message.id) || null;
        if (task) task.setProperty(TASK_PROPERTY_BUTTONS, buttons);
      }
    }
  }

  findAndFinishUTask(instance, finalPrompt, index, message) {
    const imageUrl = this.getImageUrl(message);
    const messageHash = imageUrl ? this.discordHelper.getMessageHash(imageUrl) : null;
    const condition = new TaskCondition()
      .setActionSet(new Set([TaskAction.UPSCALE]))
      .setFinalPrompt(finalPrompt)
      .setStatusSet(new Set([TaskStatus.IN_PROGRESS]));
    if (messageHash) condition.setMessageHash(messageHash);
    let task = instance.findRunningTask(condition.toFunction()).find((t) => t) || null;
    if (!task) {
      condition.setMessageHash(undefined);
      const referencedMessageId = message.referenced_message?.id || '';
      const tasks = instance.findRunningTask(condition.toFunction()).filter((t) => {
        if (!t.description?.endsWith(`U${index}`)) return false;
        return referencedMessageId ? t.getProperty(TASK_PROPERTY_REFERENCED_MESSAGE_ID) === referencedMessageId : true;
      });
      task = tasks.sort((a, b) => (a.startTime || 0) - (b.startTime || 0))[0] || null;
    }
    if (!task) return;
    message[MJ_MESSAGE_HANDLED] = true;
    task.setProperty(TASK_PROPERTY_FINAL_PROMPT, finalPrompt);
    if (messageHash) task.setProperty(TASK_PROPERTY_MESSAGE_HASH, messageHash);
    if (imageUrl) task.imageUrl = imageUrl;
    const buttons = extractButtonsFromMessage(message);
    if (buttons?.length > 0) task.setProperty(TASK_PROPERTY_BUTTONS, buttons);
    this.finishTask(instance, task, message);
  }

  getParseData(content) {
    let parseData = parseContentWithRegex(content, CONTENT_REGEX_1);
    if (!parseData) parseData = parseContentWithRegex(content, CONTENT_REGEX_2);
    if (parseData) return parseData;
    const match = content.match(new RegExp(CONTENT_REGEX_U));
    if (!match || match.length < 3) return null;
    return {
      prompt: match[1] || '',
      status: 'done',
      index: parseInt(match[2] || '1', 10),
    };
  }
}
