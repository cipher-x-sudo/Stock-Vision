/**
 * Reroll success handler
 */

import { MessageHandler } from './messageHandler.js';
import { MessageType } from '../../constants.js';
import { TaskAction } from '../../constants.js';
import { parseContentWithRegex } from '../../utils/convertUtils.js';

const CONTENT_REGEX_1 = '\\*\\*(.*)\\*\\* - <@\\d+> \\((.*?)\\)';
const CONTENT_REGEX_2 = '\\*\\*(.*)\\*\\* - Variations by <@\\d+> \\((.*?)\\)';
const CONTENT_REGEX_3 = '\\*\\*(.*)\\*\\* - Variations \\(.*?\\) by <@\\d+> \\((.*?)\\)';

export class RerollSuccessHandler extends MessageHandler {
  order() {
    return 104;
  }

  handle(instance, messageType, message, eventType) {
    const content = this.getMessageContent(message);
    const parseData = this.getParseData(content);
    if (messageType === MessageType.CREATE && parseData && this.hasImage(message)) {
      this.findAndFinishImageTask(instance, TaskAction.REROLL, parseData.prompt, message);
    }
  }

  getParseData(content) {
    return (
      parseContentWithRegex(content, CONTENT_REGEX_1) ||
      parseContentWithRegex(content, CONTENT_REGEX_2) ||
      parseContentWithRegex(content, CONTENT_REGEX_3)
    );
  }
}
