/**
 * Task condition builder for findRunningTask
 */

import {
  TASK_PROPERTY_FINAL_PROMPT,
  TASK_PROPERTY_MESSAGE_ID,
  TASK_PROPERTY_MESSAGE_HASH,
  TASK_PROPERTY_PROGRESS_MESSAGE_ID,
  TASK_PROPERTY_NONCE,
  TASK_PROPERTY_DISCORD_INSTANCE_ID,
} from '../constants.js';

export class TaskCondition {
  constructor() {
    this.id = undefined;
    this.statusSet = undefined;
    this.actionSet = undefined;
    this.finalPrompt = undefined;
    this.messageId = undefined;
    this.messageHash = undefined;
    this.progressMessageId = undefined;
    this.nonce = undefined;
    this.instanceId = undefined;
  }

  setProgressMessageId(progressMessageId) {
    this.progressMessageId = progressMessageId;
    return this;
  }

  setId(id) {
    this.id = id;
    return this;
  }

  setStatusSet(statusSet) {
    this.statusSet = statusSet;
    return this;
  }

  setActionSet(actionSet) {
    this.actionSet = actionSet;
    return this;
  }

  setFinalPrompt(finalPrompt) {
    this.finalPrompt = finalPrompt;
    return this;
  }

  setMessageHash(messageHash) {
    this.messageHash = messageHash;
    return this;
  }

  setNonce(nonce) {
    this.nonce = nonce;
    return this;
  }

  test(task) {
    if (!task) return false;
    if (this.id && this.id !== task.id) return false;
    if (this.statusSet && this.statusSet.size > 0 && !this.statusSet.has(task.status)) return false;
    if (this.actionSet && this.actionSet.size > 0 && !this.actionSet.has(task.action)) return false;
    if (this.finalPrompt && this.finalPrompt !== task.getProperty(TASK_PROPERTY_FINAL_PROMPT)) return false;
    if (this.messageId && this.messageId !== task.getProperty(TASK_PROPERTY_MESSAGE_ID)) return false;
    if (this.messageHash && this.messageHash !== task.getProperty(TASK_PROPERTY_MESSAGE_HASH)) return false;
    if (this.progressMessageId && this.progressMessageId !== task.getProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID)) return false;
    if (this.nonce && this.nonce !== task.getProperty(TASK_PROPERTY_NONCE)) return false;
    if (this.instanceId && this.instanceId !== task.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID)) return false;
    return true;
  }

  toFunction() {
    return (task) => this.test(task);
  }
}
