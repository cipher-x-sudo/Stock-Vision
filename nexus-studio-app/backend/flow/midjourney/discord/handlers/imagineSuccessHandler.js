/**
 * Imagine success handler
 */

import { MessageHandler } from './messageHandler.js';
import { MessageType } from '../../constants.js';
import { TaskAction } from '../../constants.js';
import { parseContentWithRegex } from '../../utils/convertUtils.js';

const CONTENT_REGEX = '\\*\\*(.*)\\*\\* - <@\\d+> \\((.*?)\\)';

export class ImagineSuccessHandler extends MessageHandler {
  order() {
    return 101;
  }

  handle(instance, messageType, message, eventType) {
    const content = this.getMessageContent(message);
    const parseData = parseContentWithRegex(content, CONTENT_REGEX);
    if (messageType === MessageType.CREATE && parseData && this.hasImage(message)) {
      this.findAndFinishImageTask(instance, TaskAction.IMAGINE, parseData.prompt, message);
    }
  }
}
