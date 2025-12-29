export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface SelectorOptions {
  debug?: boolean;
  logger?: Logger;
}

export interface Selector {
  get(): string | null;
  get(defaultValue: string): string;
  getall(): string[];

  readonly ok: boolean;
  readonly count: number;
  readonly selector: string;

  xpath(query: string): Selector;
  css(query: string): Selector;

  or(fallback: Selector): Selector;
  map<T>(fn: (value: string) => T): MappedSelector<T>;

  re(pattern: RegExp | string): MappedSelector<string>;
  re_first(pattern: RegExp | string, defaultValue?: string): string | null;

  jmespath(query: string): JsonSelector;

  first(): Selector;
  last(): Selector;
  eq(index: number): Selector;

  each(fn: (sel: Selector, index: number) => void): void;
  toArray(): Selector[];
  [Symbol.iterator](): Iterator<Selector>;

  text(): string;
  attr(name: string): string | null;
  html(): string | null;

  result(): SelectResult;
}

export interface MappedSelector<T> {
  get(): T | null;
  get(defaultValue: T): T;
  getall(): T[];
  readonly ok: boolean;
}

export interface JsonSelector {
  get(): unknown;
  get<T>(defaultValue: T): T;
  getall(): unknown[];
  readonly ok: boolean;
  jmespath(query: string): JsonSelector;
}

export type SelectResult =
  | { ok: true; value: string; count: number }
  | { ok: false; selector: string };

export interface PluckOptions {
  debug?: boolean;
  logger?: Logger;
}

export class ConsoleLogger implements Logger {
  debug(message: string, context?: Record<string, unknown>): void {
    if (context) {
      console.debug(`[pluck:debug] ${message}`, context);
    } else {
      console.debug(`[pluck:debug] ${message}`);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (context) {
      console.info(`[pluck:info] ${message}`, context);
    } else {
      console.info(`[pluck:info] ${message}`);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (context) {
      console.warn(`[pluck:warn] ${message}`, context);
    } else {
      console.warn(`[pluck:warn] ${message}`);
    }
  }

  error(message: string, context?: Record<string, unknown>): void {
    if (context) {
      console.error(`[pluck:error] ${message}`, context);
    } else {
      console.error(`[pluck:error] ${message}`);
    }
  }
}

export class NoopLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}
