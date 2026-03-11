/**
 * In-memory task store - save, get, list, delete
 */

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class InMemoryTaskStoreService {
  constructor(timeoutMs = DEFAULT_TTL_MS) {
    this.taskMap = new Map();
    this.timeoutMs = timeoutMs;
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  save(task) {
    if (!task || !task.id) return;
    const expiresAt = Date.now() + this.timeoutMs;
    this.taskMap.set(task.id, { task, expiresAt });
  }

  delete(id) {
    this.taskMap.delete(id);
  }

  get(id) {
    const entry = this.taskMap.get(id);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.taskMap.delete(id);
      return undefined;
    }
    return entry.task;
  }

  list(condition) {
    this.cleanup();
    const tasks = Array.from(this.taskMap.values())
      .filter((e) => e.expiresAt >= Date.now())
      .map((e) => e.task);
    if (condition && typeof condition === 'function') {
      return tasks.filter(condition);
    }
    return tasks;
  }

  findOne(condition) {
    const list = this.list(condition);
    return list[0];
  }

  cleanup() {
    const now = Date.now();
    for (const [id, entry] of this.taskMap.entries()) {
      if (entry.expiresAt < now) this.taskMap.delete(id);
    }
  }

  destroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.taskMap.clear();
  }
}
