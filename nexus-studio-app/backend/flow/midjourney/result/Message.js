/**
 * Discord API response wrapper
 */

import { ReturnCode } from '../constants.js';

export class Message {
  constructor(code, description, result) {
    this.code = code;
    this.description = description;
    this.result = result;
  }

  getCode() {
    return this.code;
  }

  getDescription() {
    return this.description;
  }

  getResult() {
    return this.result;
  }

  static success() {
    return new Message(ReturnCode.SUCCESS, 'Success');
  }

  static successWithResult(result) {
    return new Message(ReturnCode.SUCCESS, 'Success', result);
  }

  static failureWithDescription(description) {
    return new Message(ReturnCode.FAILURE, description);
  }

  static of(code, description, result) {
    return new Message(code, description, result);
  }
}
