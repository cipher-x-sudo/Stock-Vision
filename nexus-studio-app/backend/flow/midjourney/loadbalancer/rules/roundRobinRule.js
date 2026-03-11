/**
 * Round-robin load balancing rule
 */

export class RoundRobinRule {
  constructor() {
    this.position = 0;
  }

  choose(instances) {
    if (!instances || instances.length === 0) return null;
    const pos = this.position;
    this.position = this.position === Number.MAX_SAFE_INTEGER ? 0 : this.position + 1;
    return instances[pos % instances.length];
  }
}
