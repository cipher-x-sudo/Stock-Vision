/**
 * Submit controller - Express handlers for imagine, action, modal, change, describe, shorten, blend, edits, upload-discord-images
 */

import { ReturnCode } from '../constants.js';
import { TaskAction } from '../constants.js';
import { TaskStatus } from '../constants.js';
import { BlendDimensions, getBlendDimensionsValue } from '../constants.js';
import { TASK_PROPERTY_NONCE, TASK_PROPERTY_MESSAGE_ID, TASK_PROPERTY_MESSAGE_HASH, TASK_PROPERTY_FLAGS } from '../constants.js';
import { Task } from '../models/Task.js';
import { SubmitResultVO } from '../models/SubmitResultVO.js';
import { SnowFlake } from '../utils/snowflake.js';
import { convertBase64Array } from '../utils/convertUtils.js';
import { checkBanned } from '../utils/bannedPromptUtils.js';
import { guessFileSuffix } from '../utils/mimeTypeUtils.js';
import { parseActionFromCustomId } from '../utils/actionUtils.js';

export class SubmitController {
  constructor(taskService, taskStoreService) {
    this.taskService = taskService;
    this.taskStoreService = taskStoreService;
  }

  newTask(body = {}) {
    const task = new Task();
    task.id = SnowFlake.INSTANCE.nextId();
    task.submitTime = Date.now();
    task.setProperty(TASK_PROPERTY_NONCE, SnowFlake.INSTANCE.nextId());
    if (body.notifyHook) task.setProperty('notifyHook', body.notifyHook);
    if (body.state) task.state = body.state;
    return task;
  }

  async imagine(req, res) {
    const body = req.body || {};
    let prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'prompt cannot be empty').toJSON());
      return;
    }
    const task = this.newTask(body);
    task.action = TaskAction.IMAGINE;
    task.prompt = prompt;
    task.promptEn = prompt;
    try {
      checkBanned(task.promptEn);
    } catch (e) {
      if (e?.name === 'BannedPromptException') {
        res.status(400).json(SubmitResultVO.fail(ReturnCode.BANNED_PROMPT, 'may contain sensitive words').setProperty('bannedWord', e?.message).toJSON());
        return;
      }
      throw e;
    }
    const base64Array = body.base64Array || [];
    if (body.base64) base64Array.push(body.base64);
    let dataUrls;
    try {
      dataUrls = convertBase64Array(base64Array);
    } catch (e) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'base64 format error').toJSON());
      return;
    }
    task.description = `/imagine ${prompt}`;
    const result = await this.taskService.submitImagine(task, dataUrls);
    res.json(result.toJSON());
  }

  async action(req, res) {
    const body = req.body || {};
    const taskId = body.taskId && typeof body.taskId === 'string' ? body.taskId.trim() : '';
    const customId = body.customId && typeof body.customId === 'string' ? body.customId.trim() : '';
    if (!taskId || !customId) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'taskId and customId are required').toJSON());
      return;
    }
    const task = this.taskStoreService.get(taskId);
    if (!task) {
      res.status(404).json(SubmitResultVO.fail(ReturnCode.NOT_FOUND, 'task does not exist or has expired').toJSON());
      return;
    }
    if (task.status !== TaskStatus.SUCCESS) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'related task status error').toJSON());
      return;
    }
    const messageId = task.getProperty(TASK_PROPERTY_MESSAGE_ID);
    const messageHash = task.getProperty(TASK_PROPERTY_MESSAGE_HASH);
    const messageFlags = task.getProperty(TASK_PROPERTY_FLAGS) ?? 0;
    const action = parseActionFromCustomId(customId);
    if (action === TaskAction.UPSCALE) {
      const indexMatch = customId.match(/.*[Uu](\d)/);
      const index = indexMatch ? parseInt(indexMatch[1], 10) : 1;
      const result = await this.taskService.submitUpscale(task, messageId, messageHash, index, messageFlags);
      res.json(result.toJSON());
      return;
    }
    if (action === TaskAction.VARIATION) {
      const indexMatch = customId.match(/.*[Vv](\d)/);
      const index = indexMatch ? parseInt(indexMatch[1], 10) : 1;
      const result = await this.taskService.submitVariation(task, messageId, messageHash, index, messageFlags);
      res.json(result.toJSON());
      return;
    }
    if (action === TaskAction.REROLL) {
      const result = await this.taskService.submitReroll(task, messageId, messageHash, messageFlags);
      res.json(result.toJSON());
      return;
    }
    const result = await this.taskService.submitCustomAction(task, messageId, messageFlags, customId);
    res.json(result.toJSON());
  }

  async modal(req, res) {
    const body = req.body || {};
    const taskId = body.taskId && typeof body.taskId === 'string' ? body.taskId.trim() : '';
    if (!taskId) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'taskId cannot be empty').toJSON());
      return;
    }
    const task = this.taskStoreService.get(taskId);
    if (!task) {
      res.status(404).json(SubmitResultVO.fail(ReturnCode.NOT_FOUND, 'task does not exist or has expired').toJSON());
      return;
    }
    const payload = {
      modalTaskId: body.modalTaskId || taskId,
      prompt: typeof body.prompt === 'string' ? body.prompt.trim() : undefined,
      maskBase64: typeof body.maskBase64 === 'string' ? body.maskBase64.trim() : undefined,
    };
    const result = await this.taskService.submitModal(task, payload);
    res.json(result.toJSON());
  }

  async change(req, res) {
    const body = req.body || {};
    const taskId = body.taskId && typeof body.taskId === 'string' ? body.taskId.trim() : '';
    const action = body.action && String(body.action).toUpperCase();
    const index = typeof body.index === 'number' ? body.index : parseInt(body.index, 10);
    if (!taskId) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'taskId cannot be empty').toJSON());
      return;
    }
    if (![TaskAction.UPSCALE, TaskAction.VARIATION, TaskAction.REROLL].includes(action)) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'action must be UPSCALE, VARIATION, or REROLL').toJSON());
      return;
    }
    if (isNaN(index) || index < 0 || index > 4) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'index must be 0-4').toJSON());
      return;
    }
    const task = this.taskStoreService.get(taskId);
    if (!task) {
      res.status(404).json(SubmitResultVO.fail(ReturnCode.NOT_FOUND, 'related task does not exist or has expired').toJSON());
      return;
    }
    if (task.status !== TaskStatus.SUCCESS) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'related task status error').toJSON());
      return;
    }
    const messageId = task.getProperty(TASK_PROPERTY_MESSAGE_ID);
    const messageHash = task.getProperty(TASK_PROPERTY_MESSAGE_HASH);
    const messageFlags = task.getProperty(TASK_PROPERTY_FLAGS) ?? 0;
    const idx = index === 0 ? 1 : index;
    let result;
    if (action === TaskAction.UPSCALE) {
      result = await this.taskService.submitUpscale(task, messageId, messageHash, idx, messageFlags);
    } else if (action === TaskAction.VARIATION) {
      result = await this.taskService.submitVariation(task, messageId, messageHash, idx, messageFlags);
    } else {
      result = await this.taskService.submitReroll(task, messageId, messageHash, messageFlags);
    }
    res.json(result.toJSON());
  }

  async describe(req, res) {
    const body = req.body || {};
    let base64Array = body.base64Array;
    if (body.base64) base64Array = Array.isArray(base64Array) ? [...base64Array, body.base64] : [body.base64];
    if (!Array.isArray(base64Array) || base64Array.length === 0) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'base64Array or base64 is required').toJSON());
      return;
    }
    let dataUrls;
    try {
      dataUrls = convertBase64Array(base64Array);
    } catch (e) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'base64 format error').toJSON());
      return;
    }
    const task = this.newTask(body);
    task.action = TaskAction.DESCRIBE;
    const result = await this.taskService.submitDescribe(task, dataUrls[0]);
    res.json(result.toJSON());
  }

  async shorten(req, res) {
    const prompt = typeof (req.body && req.body.prompt) === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'prompt cannot be empty').toJSON());
      return;
    }
    const task = this.newTask(req.body);
    task.action = TaskAction.SHORTEN;
    task.prompt = prompt;
    task.promptEn = prompt;
    const result = await this.taskService.submitShorten(task);
    res.json(result.toJSON());
  }

  async blend(req, res) {
    const body = req.body || {};
    const base64Array = body.base64Array;
    if (!Array.isArray(base64Array) || base64Array.length < 2 || base64Array.length > 5) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'base64Array must contain 2 to 5 images').toJSON());
      return;
    }
    let dataUrls;
    try {
      dataUrls = convertBase64Array(base64Array);
    } catch (e) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'base64 format error').toJSON());
      return;
    }
    const dimensions = body.dimensions && [BlendDimensions.PORTRAIT, BlendDimensions.SQUARE, BlendDimensions.LANDSCAPE].includes(body.dimensions)
      ? body.dimensions
      : BlendDimensions.SQUARE;
    const task = this.newTask(body);
    task.action = TaskAction.BLEND;
    const result = await this.taskService.submitBlend(task, dataUrls, getBlendDimensionsValue(dimensions));
    res.json(result.toJSON());
  }

  async edits(req, res) {
    const body = req.body || {};
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const maskBase64 = typeof body.maskBase64 === 'string' ? body.maskBase64 : '';
    const imageBase64 = body.image || body.base64;
    if (!prompt || !maskBase64 || !imageBase64) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'prompt, maskBase64, and image are required').toJSON());
      return;
    }
    let dataUrls;
    try {
      dataUrls = convertBase64Array([imageBase64]);
    } catch (e) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'image base64 format error').toJSON());
      return;
    }
    const task = this.newTask(body);
    task.action = TaskAction.VARIATION;
    task.prompt = prompt;
    task.promptEn = prompt;
    task.setProperty('edits_mask_base64', maskBase64);
    task.setProperty('edits_prompt', prompt);
    task.setProperty('edits_use_direct_api', 'true');
    task.description = '/edits';
    const result = await this.taskService.submitImagine(task, dataUrls);
    res.json(result.toJSON());
  }

  async uploadDiscordImages(req, res) {
    const base64Array = req.body?.base64Array;
    if (!Array.isArray(base64Array) || base64Array.length === 0) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'base64Array cannot be empty').toJSON());
      return;
    }
    let dataUrls;
    try {
      dataUrls = convertBase64Array(base64Array);
    } catch (e) {
      res.status(400).json(SubmitResultVO.fail(ReturnCode.VALIDATION_ERROR, 'base64 format error').toJSON());
      return;
    }
    const task = this.newTask(req.body);
    task.action = TaskAction.IMAGINE;
    task.prompt = '';
    task.promptEn = '';
    const instance = this.taskService.discordLoadBalancer.chooseInstance();
    if (!instance) {
      res.status(503).json(SubmitResultVO.fail(ReturnCode.NOT_FOUND, 'No available account').toJSON());
      return;
    }
    const filenames = [];
    for (let i = 0; i < dataUrls.length; i++) {
      const dataUrl = dataUrls[i];
      const taskFileName = `${task.id}_${i}.${guessFileSuffix(dataUrl.mimeType) || 'png'}`;
      const uploadResult = await instance.upload(taskFileName, dataUrl);
      if (uploadResult.getCode() !== ReturnCode.SUCCESS) {
        res.status(502).json(SubmitResultVO.fail(ReturnCode.FAILURE, uploadResult.getDescription()).toJSON());
        return;
      }
      filenames.push(uploadResult.getResult());
    }
    res.json(SubmitResultVO.of(ReturnCode.SUCCESS, 'Success', filenames).toJSON());
  }
}
