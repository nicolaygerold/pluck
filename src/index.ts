import { parseHTML } from "linkedom";
import { Selector } from "./selector";
import type { PluckOptions } from "./types";
import { ConsoleLogger } from "./types";

export function pluck(html: string, options: PluckOptions = {}): Selector {
  if (!html || typeof html !== "string") {
    const logger = options.logger ?? (options.debug ? new ConsoleLogger() : null);
    logger?.warn("pluck called with invalid html input", {
      type: typeof html,
      value: html === null ? "null" : html === undefined ? "undefined" : "empty",
    });
    html = "";
  }

  const { document } = parseHTML(html);
  return new Selector(document, document, "", options);
}

export { Selector } from "./selector";
export { ConsoleLogger, NoopLogger } from "./types";
export type {
  JsonSelector,
  Logger,
  LogLevel,
  MappedSelector,
  PluckOptions,
  SelectResult,
  Selector as SelectorInterface,
} from "./types";
