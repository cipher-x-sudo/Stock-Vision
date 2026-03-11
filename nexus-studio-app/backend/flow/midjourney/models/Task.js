/**
 * Task model - id, action, status, prompt, properties, etc.
 */

import { TaskStatus } from '../constants.js';
import { TASK_PROPERTY_BUTTONS } from '../constants.js';

export class Task {
  id;
  properties = {};
  action;
  status = TaskStatus.NOT_START;
  prompt;
  promptEn;
  description;
  state;
  submitTime;
  startTime;
  finishTime;
  imageUrl;
  progress;
  failReason;

  setProperty(name, value) {
    this.properties[name] = value;
    return this;
  }

  removeProperty(name) {
    delete this.properties[name];
    return this;
  }

  getProperty(name) {
    return this.properties?.[name];
  }

  start() {
    this.startTime = Date.now();
    this.status = TaskStatus.SUBMITTED;
    this.progress = '0%';
  }

  success() {
    this.finishTime = Date.now();
    this.status = TaskStatus.SUCCESS;
    this.progress = '100%';
  }

  fail(reason) {
    this.finishTime = Date.now();
    this.status = TaskStatus.FAILURE;
    this.failReason = reason;
    this.progress = '';
  }

  toJSON() {
    const json = {
      id: this.id,
      properties: this.properties,
      action: this.action,
      status: this.status,
      prompt: this.prompt,
      promptEn: this.promptEn,
      description: this.description,
      submitTime: this.submitTime,
      startTime: this.startTime,
      finishTime: this.finishTime,
      imageUrl: this.imageUrl,
      progress: this.progress,
    };
    const buttons = this.getProperty(TASK_PROPERTY_BUTTONS);
    if (buttons && Array.isArray(buttons) && buttons.length > 0) {
      json.buttons = buttons;
    }
    if (this.state !== undefined) json.state = this.state;
    if (this.failReason !== undefined) json.failReason = this.failReason;
    return json;
  }
}
