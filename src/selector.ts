import type { JsonSelector, Logger, MappedSelector, PluckOptions, SelectResult } from "./types";
import { ConsoleLogger, NoopLogger } from "./types";
import { extractValue, parseCSSPseudo, parseXPathPseudo } from "./pseudo";
import { evaluateXPath, splitXPathUnion } from "./xpath";
import { extractRegex } from "./regex";
import { search as jmespathSearch, type JSONValue } from "@metrichor/jmespath";

function getLogger(options: PluckOptions): Logger {
  if (options.logger) {
    return options.logger;
  }
  return options.debug ? new ConsoleLogger() : new NoopLogger();
}

export class Selector implements Iterable<Selector> {
  readonly #nodes: Node[];
  readonly #document: Document;
  readonly #selector: string;
  readonly #options: PluckOptions;
  readonly #logger: Logger;

  constructor(
    nodes: Node | Node[],
    document: Document,
    selector: string = "",
    options: PluckOptions = {},
  ) {
    this.#nodes = Array.isArray(nodes) ? nodes : [nodes];
    this.#document = document;
    this.#selector = selector;
    this.#options = options;
    this.#logger = getLogger(options);

    if (selector) {
      this.#logger.debug(`selector matched`, {
        selector,
        matches: this.#nodes.length,
      });
    }
  }

  get ok(): boolean {
    return this.#nodes.length > 0;
  }

  get count(): number {
    return this.#nodes.length;
  }

  get selector(): string {
    return this.#selector;
  }

  protected get document(): Document {
    return this.#document;
  }

  protected get options(): PluckOptions {
    return this.#options;
  }

  get(defaultValue?: string): string | null {
    const values = this.getall();
    if (values.length === 0) {
      return defaultValue ?? null;
    }
    return values[0];
  }

  getall(): string[] {
    return this.#nodes
      .map((node) => {
        if (node.nodeType === 2) {
          return (node as Attr).value;
        }
        if (node.nodeType === 3) {
          return node.textContent?.trim() ?? "";
        }
        if (node.nodeType === 1) {
          return (node as Element).outerHTML;
        }
        return node.textContent?.trim() ?? "";
      })
      .filter((v) => v !== "");
  }

  xpath(query: string): Selector {
    const unionParts = splitXPathUnion(query);
    if (unionParts.length > 1) {
      const allStrings: string[] = [];
      const allNodes: Node[] = [];
      const seenNodes = new Set<Node>();

      for (const part of unionParts) {
        const partResult = this.#evaluateSingleXPath(part.trim());
        if (partResult === null) {
          return new Selector([], this.#document, query, this.#options);
        }
        if (partResult.type === "strings") {
          allStrings.push(...partResult.values);
        } else {
          for (const node of partResult.nodes) {
            if (!seenNodes.has(node)) {
              seenNodes.add(node);
              allNodes.push(node);
            }
          }
        }
      }

      if (allStrings.length > 0) {
        return new TextSelector(allStrings, this.#document, query, this.#options);
      }
      return new Selector(allNodes, this.#document, query, this.#options);
    }

    const result = this.#evaluateSingleXPath(query);
    if (result === null) {
      return new Selector([], this.#document, query, this.#options);
    }
    if (result.type === "strings") {
      return new TextSelector(result.values, this.#document, query, this.#options);
    }
    return new Selector(result.nodes, this.#document, query, this.#options);
  }

  #evaluateSingleXPath(
    query: string,
  ): { type: "strings"; values: string[] } | { type: "nodes"; nodes: Node[] } | null {
    const parsed = parseXPathPseudo(query);
    let xpathResults: ReturnType<typeof evaluateXPath>;

    try {
      xpathResults = evaluateXPath(parsed.query, this.#nodes, this.#logger);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.#logger.error(`xpath evaluation failed`, {
        query,
        parsed: parsed.query,
        error: message,
      });
      return null;
    }

    const stringResults: string[] = [];
    const nodeResults: Node[] = [];

    for (const result of xpathResults) {
      if (typeof result === "string") {
        stringResults.push(result);
      } else {
        nodeResults.push(result);
      }
    }

    if (stringResults.length > 0) {
      return { type: "strings", values: stringResults };
    }

    if (parsed.extract === "text" || parsed.extract === "attr") {
      const extracted = nodeResults
        .map((n) => extractValue(n, parsed.extract, parsed.attrName))
        .filter((v): v is string => v !== null);
      return { type: "strings", values: extracted };
    }

    return { type: "nodes", nodes: nodeResults };
  }

  css(query: string): Selector {
    const parsed = parseCSSPseudo(query);
    const results: Element[] = [];

    for (const node of this.#nodes) {
      if (node.nodeType === 1 || node.nodeType === 9) {
        const parent = node as Element | Document;
        try {
          const matches = parent.querySelectorAll(parsed.query);
          results.push(...Array.from(matches));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.#logger.warn(`invalid CSS selector`, {
            selector: query,
            parsed: parsed.query,
            error: message,
          });
        }
      }
    }

    if (parsed.extract === "text" || parsed.extract === "attr") {
      const extracted = results
        .map((n) => extractValue(n, parsed.extract, parsed.attrName))
        .filter((v): v is string => v !== null);

      return new TextSelector(extracted, this.#document, query, this.#options);
    }

    return new Selector(results, this.#document, query, this.#options);
  }

  or(fallback: Selector): Selector {
    if (this.ok) {
      return this;
    }
    return fallback;
  }

  map<T>(fn: (value: string) => T): MappedSelector<T> {
    const values = this.getall();
    return new MappedSelectorImpl(values.map(fn), this.ok);
  }

  re(pattern: RegExp | string): MappedSelector<string> {
    const values = this.getall();
    const results = values.flatMap((v) => extractRegex(pattern, v));
    return new MappedSelectorImpl(results, results.length > 0);
  }

  re_first(pattern: RegExp | string, defaultValue?: string): string | null {
    const result = this.re(pattern).get();
    return result ?? defaultValue ?? null;
  }

  jmespath(query: string): JsonSelector {
    const values = this.getall();
    const results: unknown[] = [];

    for (const value of values) {
      try {
        const parsed = JSON.parse(value);
        const result = jmespathSearch(parsed, query);
        if (result !== null && result !== undefined) {
          results.push(result);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.#logger.warn(`jmespath failed to parse or query JSON`, {
          query,
          error: message,
          valuePreview: value.slice(0, 100),
        });
      }
    }

    return new JsonSelectorImpl(results, this.#logger);
  }

  first(): Selector {
    if (this.#nodes.length === 0) {
      return new Selector([], this.#document, this.#selector, this.#options);
    }
    return new Selector([this.#nodes[0]], this.#document, this.#selector, this.#options);
  }

  last(): Selector {
    if (this.#nodes.length === 0) {
      return new Selector([], this.#document, this.#selector, this.#options);
    }
    return new Selector(
      [this.#nodes[this.#nodes.length - 1]],
      this.#document,
      this.#selector,
      this.#options,
    );
  }

  eq(index: number): Selector {
    const node = this.#nodes[index];
    if (!node) {
      return new Selector([], this.#document, this.#selector, this.#options);
    }
    return new Selector([node], this.#document, this.#selector, this.#options);
  }

  each(fn: (sel: Selector, index: number) => void): void {
    this.#nodes.forEach((node, i) => {
      fn(new Selector([node], this.#document, this.#selector, this.#options), i);
    });
  }

  toArray(): Selector[] {
    return this.#nodes.map(
      (node) => new Selector([node], this.#document, this.#selector, this.#options),
    );
  }

  *[Symbol.iterator](): Iterator<Selector> {
    for (const node of this.#nodes) {
      yield new Selector([node], this.#document, this.#selector, this.#options);
    }
  }

  text(): string {
    return this.#nodes
      .map((n) => n.textContent?.trim() ?? "")
      .filter((v) => v !== "")
      .join(" ");
  }

  attr(name: string): string | null {
    const node = this.#nodes[0];
    if (node?.nodeType === 1) {
      return (node as Element).getAttribute(name);
    }
    return null;
  }

  html(): string | null {
    const node = this.#nodes[0];
    if (node?.nodeType === 9) {
      const doc = node as Document;
      return doc.documentElement?.outerHTML ?? null;
    }
    if (node?.nodeType === 1) {
      return (node as Element).innerHTML;
    }
    return null;
  }

  outerHtml(): string | null {
    const node = this.#nodes[0];
    if (node?.nodeType === 9) {
      const doc = node as Document;
      return doc.documentElement?.outerHTML ?? null;
    }
    if (node?.nodeType === 1) {
      return (node as Element).outerHTML;
    }
    return null;
  }

  remove(): void {
    for (const node of this.#nodes) {
      if (node.nodeType === 1) {
        (node as Element).remove();
      } else if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
  }

  result(): SelectResult {
    if (this.ok) {
      return {
        ok: true,
        value: this.get() ?? "",
        count: this.count,
      };
    }
    return {
      ok: false,
      selector: this.#selector,
    };
  }
}

class TextSelector extends Selector {
  readonly #values: string[];

  constructor(values: string[], document: Document, selector: string, options: PluckOptions) {
    super([], document, selector, options);
    this.#values = values;
  }

  override get ok(): boolean {
    return this.#values.length > 0;
  }

  override get count(): number {
    return this.#values.length;
  }

  override get(defaultValue?: string): string | null {
    if (this.#values.length === 0) {
      return defaultValue ?? null;
    }
    return this.#values[0];
  }

  override getall(): string[] {
    return this.#values;
  }

  override text(): string {
    return this.#values.join(" ");
  }

  override map<T>(fn: (value: string) => T): MappedSelector<T> {
    return new MappedSelectorImpl(this.#values.map(fn), this.ok);
  }

  override first(): Selector {
    if (this.#values.length === 0) {
      return new TextSelector([], this.document, this.selector, this.options);
    }
    return new TextSelector([this.#values[0]], this.document, this.selector, this.options);
  }

  override last(): Selector {
    if (this.#values.length === 0) {
      return new TextSelector([], this.document, this.selector, this.options);
    }
    return new TextSelector(
      [this.#values[this.#values.length - 1]],
      this.document,
      this.selector,
      this.options,
    );
  }

  override eq(index: number): Selector {
    const value = this.#values[index];
    if (value === undefined) {
      return new TextSelector([], this.document, this.selector, this.options);
    }
    return new TextSelector([value], this.document, this.selector, this.options);
  }

  override each(fn: (sel: Selector, index: number) => void): void {
    this.#values.forEach((value, i) => {
      fn(new TextSelector([value], this.document, this.selector, this.options), i);
    });
  }

  override toArray(): Selector[] {
    return this.#values.map(
      (value) => new TextSelector([value], this.document, this.selector, this.options),
    );
  }

  override *[Symbol.iterator](): Iterator<Selector> {
    for (const value of this.#values) {
      yield new TextSelector([value], this.document, this.selector, this.options);
    }
  }

  override jmespath(query: string): JsonSelector {
    const results: unknown[] = [];

    for (const value of this.#values) {
      try {
        const parsed = JSON.parse(value);
        const result = jmespathSearch(parsed, query);
        if (result !== null && result !== undefined) {
          results.push(result);
        }
      } catch {
        // TextSelector values may not be valid JSON, skip silently
      }
    }

    return new JsonSelectorImpl(results, new NoopLogger());
  }
}

class JsonSelectorImpl implements JsonSelector {
  readonly #values: unknown[];
  readonly #logger: Logger;

  constructor(values: unknown[], logger: Logger) {
    this.#values = values;
    this.#logger = logger;
  }

  get ok(): boolean {
    return this.#values.length > 0;
  }

  get<T>(defaultValue?: T): T | unknown | null {
    if (this.#values.length === 0) {
      return defaultValue ?? null;
    }
    return this.#values[0];
  }

  getall(): unknown[] {
    return this.#values;
  }

  jmespath(query: string): JsonSelector {
    const results: unknown[] = [];

    for (const value of this.#values) {
      try {
        const result = jmespathSearch(value as JSONValue, query);
        if (result !== null && result !== undefined) {
          results.push(result);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.#logger.warn(`jmespath query failed`, {
          query,
          error: message,
        });
      }
    }

    return new JsonSelectorImpl(results, this.#logger);
  }
}

class MappedSelectorImpl<T> implements MappedSelector<T> {
  readonly #values: T[];
  readonly ok: boolean;

  constructor(values: T[], ok: boolean) {
    this.#values = values;
    this.ok = ok;
  }

  get(defaultValue?: T): T | null {
    if (this.#values.length === 0) {
      return defaultValue ?? null;
    }
    return this.#values[0];
  }

  getall(): T[] {
    return this.#values;
  }
}
