/**
 * Submission result - code, description, result (taskId), properties
 */

export class SubmitResultVO {
  constructor(code, description, result) {
    this.code = code;
    this.description = description;
    this.result = result;
    this.properties = {};
  }

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

  static of(code, description, result) {
    return new SubmitResultVO(code, description, result);
  }

  static fail(code, description) {
    return new SubmitResultVO(code, description);
  }

  toJSON() {
    return { code: this.code, description: this.description, result: this.result, ...this.properties };
  }
}
