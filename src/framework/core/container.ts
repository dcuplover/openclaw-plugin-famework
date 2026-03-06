import type { ServiceContainer } from "./types";

export class MapServiceContainer implements ServiceContainer {
  private readonly services = new Map<string, unknown>();

  register<T>(key: string, value: T): void {
    this.services.set(key, value);
  }

  resolve<T>(key: string): T {
    if (!this.services.has(key)) {
      throw new Error(`Service not found: ${key}`);
    }
    return this.services.get(key) as T;
  }

  tryResolve<T>(key: string): T | undefined {
    return this.services.get(key) as T | undefined;
  }

  has(key: string): boolean {
    return this.services.has(key);
  }

  entries(): Array<[string, unknown]> {
    return Array.from(this.services.entries());
  }
}
