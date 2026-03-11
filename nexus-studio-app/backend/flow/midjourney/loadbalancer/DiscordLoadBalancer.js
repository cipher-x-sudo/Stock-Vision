/**
 * Discord load balancer - choose instance by rule, get queue tasks
 */

export class DiscordLoadBalancer {
  constructor(rule) {
    this.rule = rule;
    this.instances = [];
  }

  getAllInstances() {
    return [...this.instances];
  }

  getAliveInstances() {
    return this.instances.filter((i) => i.isAlive());
  }

  chooseInstance() {
    return this.rule.choose(this.getAliveInstances());
  }

  getDiscordInstance(instanceId) {
    if (!instanceId) return null;
    return this.instances.find((i) => i.getInstanceId() === instanceId) || null;
  }

  getQueueTasks() {
    const tasks = [];
    for (const instance of this.getAliveInstances()) {
      tasks.push(...instance.getQueueTasks());
    }
    return tasks;
  }

  addInstance(instance) {
    this.instances.push(instance);
  }

  removeInstance(instance) {
    const i = this.instances.indexOf(instance);
    if (i >= 0) this.instances.splice(i, 1);
  }
}
