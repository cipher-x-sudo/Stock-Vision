/**
 * Task service - submitImagine, submitUpscale, submitVariation, etc.
 */

import { ReturnCode } from '../constants.js';
import { TaskStatus } from '../constants.js';
import { Message } from '../result/Message.js';
import { SubmitResultVO } from '../models/SubmitResultVO.js';
import {
  TASK_PROPERTY_DISCORD_INSTANCE_ID,
  TASK_PROPERTY_NONCE,
  TASK_PROPERTY_MESSAGE_ID,
  TASK_PROPERTY_FLAGS,
  TASK_PROPERTY_CUSTOM_ID,
  TASK_PROPERTY_FINAL_PROMPT,
} from '../constants.js';
import { guessFileSuffix } from '../utils/mimeTypeUtils.js';

export class TaskService {
  constructor(taskStoreService, discordLoadBalancer) {
    this.taskStoreService = taskStoreService;
    this.discordLoadBalancer = discordLoadBalancer;
  }

  async submitImagine(task, dataUrls) {
    const instance = this.discordLoadBalancer.chooseInstance();
    if (!instance) return SubmitResultVO.fail(ReturnCode.NOT_FOUND, 'No available account instance');
    task.setProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID, instance.getInstanceId());
    return instance.submitTask(task, async () => {
      const imageUrls = [];
      for (const dataUrl of dataUrls) {
        const taskFileName = `${task.id}.${guessFileSuffix(dataUrl.mimeType) || 'png'}`;
        const uploadResult = await instance.upload(taskFileName, dataUrl);
        if (uploadResult.getCode() !== ReturnCode.SUCCESS) return Message.of(uploadResult.getCode(), uploadResult.getDescription());
        const finalFileName = uploadResult.getResult();
        const sendResult = await instance.sendImageMessage(`upload image: ${finalFileName}`, finalFileName);
        if (sendResult.getCode() !== ReturnCode.SUCCESS) return Message.of(sendResult.getCode(), sendResult.getDescription());
        imageUrls.push(sendResult.getResult());
      }
      if (imageUrls.length > 0) {
        task.prompt = `${imageUrls.join(' ')} ${task.prompt || ''}`;
        task.promptEn = `${imageUrls.join(' ')} ${task.promptEn || ''}`;
        task.description = `/imagine ${task.prompt}`;
        await this.taskStoreService.save(task);
      }
      const nonce = task.getProperty(TASK_PROPERTY_NONCE);
      return instance.imagine(task.promptEn || task.prompt || '', nonce || '');
    });
  }

  async submitUpscale(task, targetMessageId, targetMessageHash, index, messageFlags) {
    const instanceId = task.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
    const instance = this.discordLoadBalancer.getDiscordInstance(instanceId);
    if (!instance || !instance.isAlive()) return SubmitResultVO.fail(ReturnCode.NOT_FOUND, `Account unavailable: ${instanceId}`);
    const nonce = task.getProperty(TASK_PROPERTY_NONCE);
    return instance.submitTask(task, () => instance.upscale(targetMessageId, index, targetMessageHash, messageFlags, nonce || ''));
  }

  async submitVariation(task, targetMessageId, targetMessageHash, index, messageFlags) {
    const instanceId = task.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
    const instance = this.discordLoadBalancer.getDiscordInstance(instanceId);
    if (!instance || !instance.isAlive()) return SubmitResultVO.fail(ReturnCode.NOT_FOUND, `Account unavailable: ${instanceId}`);
    const nonce = task.getProperty(TASK_PROPERTY_NONCE);
    return instance.submitTask(task, () => instance.variation(targetMessageId, index, targetMessageHash, messageFlags, nonce || ''));
  }

  async submitReroll(task, targetMessageId, targetMessageHash, messageFlags) {
    const instanceId = task.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
    const instance = this.discordLoadBalancer.getDiscordInstance(instanceId);
    if (!instance || !instance.isAlive()) return SubmitResultVO.fail(ReturnCode.NOT_FOUND, `Account unavailable: ${instanceId}`);
    const nonce = task.getProperty(TASK_PROPERTY_NONCE);
    return instance.submitTask(task, () => instance.reroll(targetMessageId, targetMessageHash, messageFlags, nonce || ''));
  }

  async submitDescribe(task, dataUrl) {
    const instance = this.discordLoadBalancer.chooseInstance();
    if (!instance) return SubmitResultVO.fail(ReturnCode.NOT_FOUND, 'No available account instance');
    task.setProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID, instance.getInstanceId());
    return instance.submitTask(task, async () => {
      const taskFileName = `${task.id}.${guessFileSuffix(dataUrl.mimeType) || 'png'}`;
      const uploadResult = await instance.upload(taskFileName, dataUrl);
      if (uploadResult.getCode() !== ReturnCode.SUCCESS) return Message.of(uploadResult.getCode(), uploadResult.getDescription());
      const finalFileName = uploadResult.getResult();
      const nonce = task.getProperty(TASK_PROPERTY_NONCE);
      return instance.describe(finalFileName, nonce || '');
    });
  }

  async submitShorten(task) {
    const instance = this.discordLoadBalancer.chooseInstance();
    if (!instance) return SubmitResultVO.fail(ReturnCode.NOT_FOUND, 'No available account instance');
    task.setProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID, instance.getInstanceId());
    return instance.submitTask(task, () => {
      const nonce = task.getProperty(TASK_PROPERTY_NONCE);
      return instance.shorten(task.promptEn || task.prompt || '', nonce || '');
    });
  }

  async submitBlend(task, dataUrls, dimensions) {
    const instance = this.discordLoadBalancer.chooseInstance();
    if (!instance) return SubmitResultVO.fail(ReturnCode.NOT_FOUND, 'No available account instance');
    task.setProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID, instance.getInstanceId());
    return instance.submitTask(task, async () => {
      const finalFileNames = [];
      for (const dataUrl of dataUrls) {
        const taskFileName = `${task.id}.${guessFileSuffix(dataUrl.mimeType) || 'png'}`;
        const uploadResult = await instance.upload(taskFileName, dataUrl);
        if (uploadResult.getCode() !== ReturnCode.SUCCESS) return Message.of(uploadResult.getCode(), uploadResult.getDescription());
        finalFileNames.push(uploadResult.getResult());
      }
      const nonce = task.getProperty(TASK_PROPERTY_NONCE);
      return instance.blend(finalFileNames, dimensions, nonce || '');
    });
  }

  async submitCustomAction(task, targetMessageId, messageFlags, customId) {
    const instanceId = task.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
    const instance = this.discordLoadBalancer.getDiscordInstance(instanceId);
    if (!instance || !instance.isAlive()) return SubmitResultVO.fail(ReturnCode.NOT_FOUND, `Account unavailable: ${instanceId}`);
    if (customId.startsWith('MJ::CustomZoom::') || customId.startsWith('MJ::Inpaint::')) {
      task.status = TaskStatus.MODAL;
      task.setProperty(TASK_PROPERTY_MESSAGE_ID, targetMessageId);
      task.setProperty(TASK_PROPERTY_FLAGS, messageFlags);
      task.setProperty(TASK_PROPERTY_CUSTOM_ID, customId);
      await this.taskStoreService.save(task);
      instance.addRunningTask(task);
      return SubmitResultVO.of(ReturnCode.EXISTED, 'Waiting for window confirm', task.id).setProperty(TASK_PROPERTY_FINAL_PROMPT, task.getProperty(TASK_PROPERTY_FINAL_PROMPT) || '').setProperty('remix', true);
    }
    const nonce = task.getProperty(TASK_PROPERTY_NONCE);
    return instance.submitTask(task, () => instance.customAction(targetMessageId, messageFlags, customId, nonce || ''));
  }

  async submitModal(task, payload) {
    const instanceId = task.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
    const instance = this.discordLoadBalancer.getDiscordInstance(instanceId);
    if (!instance || !instance.isAlive()) return SubmitResultVO.fail(ReturnCode.NOT_FOUND, `Account unavailable: ${instanceId}`);
    const modalTaskId = payload.modalTaskId || task.id;
    const nonce = task.getProperty(TASK_PROPERTY_NONCE) || '';
    const result = await instance.modalSubmit(modalTaskId, { prompt: payload.prompt, maskBase64: payload.maskBase64 }, nonce);
    if (result.getCode() !== ReturnCode.SUCCESS) return SubmitResultVO.fail(ReturnCode.FAILURE, result.getDescription());
    task.status = TaskStatus.SUBMITTED;
    task.startTime = Date.now();
    task.progress = '0%';
    if (payload.prompt) task.setProperty(TASK_PROPERTY_FINAL_PROMPT, payload.prompt);
    await this.taskStoreService.save(task);
    instance.addRunningTask(task);
    return SubmitResultVO.of(ReturnCode.SUCCESS, 'Success', task.id);
  }

  async submitEdits(task, messageId, customId, maskBase64, prompt) {
    const instanceId = task.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
    const instance = this.discordLoadBalancer.getDiscordInstance(instanceId);
    if (!instance || !instance.isAlive()) return SubmitResultVO.fail(ReturnCode.NOT_FOUND, `Account unavailable: ${instanceId}`);
    const nonce = task.getProperty(TASK_PROPERTY_NONCE);
    return instance.submitTask(task, () => instance.edits(messageId, customId, nonce || ''));
  }
}
