import type { Logger } from "./types";
import { NoopLogger } from "./types";

export type XPathResult = Node | string;

interface Step {
  axis:
    | "child"
    | "descendant"
    | "self"
    | "attribute"
    | "parent"
    | "ancestor"
    | "following-sibling"
    | "preceding-sibling"
    | "following"
    | "preceding";
  nodeTest: NodeTest;
  predicates: Predicate[];
}

type NodeTest =
  | { type: "name"; name: string }
  | { type: "any" }
  | { type: "text" }
  | { type: "node" };

type Predicate =
  | { type: "position"; index: number }
  | { type: "attr-exists"; name: string }
  | { type: "attr-equals"; name: string; value: string }
  | { type: "text-equals"; value: string }
  | { type: "text-contains"; value: string }
  | { type: "attr-contains"; name: string; value: string }
  | { type: "attr-starts-with"; name: string; value: string }
  | { type: "attr-ends-with"; name: string; value: string }
  | { type: "text-starts-with"; value: string }
  | { type: "text-ends-with"; value: string }
  | { type: "has-child"; tagName: string }
  | { type: "not"; inner: Predicate }
  | { type: "and"; left: Predicate; right: Predicate }
  | { type: "or"; left: Predicate; right: Predicate }
  | { type: "attr-not-equals"; name: string; value: string }
  | { type: "text-not-equals"; value: string }
  | { type: "normalize-space-equals"; value: string }
  | { type: "last" }
  | { type: "position-compare"; operator: "<" | ">" | "<=" | ">="; value: number }
  | {
      type: "count-compare";
      tagName: string;
      operator: "<" | ">" | "<=" | ">=" | "=";
      value: number;
    }
  | { type: "string-length-compare"; operator: "<" | ">" | "<=" | ">=" | "="; value: number }
  | { type: "substring-equals"; start: number; length?: number; value: string }
  | { type: "substring-before-equals"; delimiter: string; value: string }
  | { type: "substring-after-equals"; delimiter: string; value: string }
  | { type: "translate-equals"; from: string; to: string; value: string };

export function evaluateXPath(
  expr: string,
  context: Node | Node[],
  logger: Logger = new NoopLogger(),
): XPathResult[] {
  const contexts = Array.isArray(context) ? context : [context];

  if (!expr || expr.trim() === "") {
    logger.warn("empty xpath expression provided");
    return [];
  }

  // Handle union operator |
  const unionParts = splitUnion(expr);
  if (unionParts.length > 1) {
    logger.debug("processing xpath union", { parts: unionParts.length });
    const allResults: XPathResult[] = [];
    const seen = new Set<Node>();
    for (const part of unionParts) {
      const partResults = evaluateSingleXPath(part.trim(), contexts, logger);
      for (const result of partResults) {
        if (typeof result === "string") {
          allResults.push(result);
        } else if (!seen.has(result)) {
          seen.add(result);
          allResults.push(result);
        }
      }
    }
    return allResults;
  }

  return evaluateSingleXPath(expr, contexts, logger);
}

function splitUnion(expr: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inString: string | null = null;

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];

    if (inString) {
      current += char;
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      current += char;
      continue;
    }

    if (char === "(" || char === "[") {
      depth++;
      current += char;
      continue;
    }

    if (char === ")" || char === "]") {
      depth--;
      current += char;
      continue;
    }

    if (depth === 0 && char === "|") {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function evaluateSingleXPath(expr: string, contexts: Node[], logger: Logger): XPathResult[] {
  const steps = parseXPath(expr, logger);

  if (steps.length === 0 && expr.trim() !== "") {
    logger.warn("xpath parsing produced no steps", { expression: expr });
  }

  let results: XPathResult[] = [...contexts];

  for (const step of steps) {
    results = evaluateStep(step, results as Node[]);
  }

  return results;
}

function parseXPath(expr: string, logger: Logger): Step[] {
  const steps: Step[] = [];
  let remaining = expr.trim();

  while (remaining.length > 0) {
    const { step, rest } = parseStep(remaining);
    if (step) {
      steps.push(step);
    }
    if (rest === remaining) {
      if (remaining.length > 0) {
        logger.warn("unparseable xpath segment", {
          segment: remaining.slice(0, 50),
          expression: expr,
        });
      }
      break;
    }
    remaining = rest;
  }

  return steps;
}

function parseStep(expr: string): { step: Step | null; rest: string } {
  let remaining = expr;
  let axis: Step["axis"] = "child";

  if (remaining.startsWith("//")) {
    axis = "descendant";
    remaining = remaining.slice(2);
  } else if (remaining.startsWith("/")) {
    axis = "child";
    remaining = remaining.slice(1);
  } else if (remaining.startsWith(".//")) {
    axis = "descendant";
    remaining = remaining.slice(3);
  } else if (remaining.startsWith("./")) {
    axis = "child";
    remaining = remaining.slice(2);
  } else if (remaining.startsWith("..")) {
    return {
      step: { axis: "parent", nodeTest: { type: "node" }, predicates: [] },
      rest: remaining.slice(2),
    };
  } else if (remaining.startsWith(".")) {
    return {
      step: { axis: "self", nodeTest: { type: "node" }, predicates: [] },
      rest: remaining.slice(1),
    };
  }

  const axisMatch = remaining.match(
    /^(following-sibling|preceding-sibling|following|preceding|ancestor|parent|self)::/,
  );
  if (axisMatch) {
    axis = axisMatch[1] as Step["axis"];
    remaining = remaining.slice(axisMatch[0].length);
  }

  if (remaining.startsWith("@")) {
    const attrMatch = remaining.match(/^@([\w-]+)/);
    if (attrMatch) {
      return {
        step: {
          axis: "attribute",
          nodeTest: { type: "name", name: attrMatch[1] },
          predicates: [],
        },
        rest: remaining.slice(attrMatch[0].length),
      };
    }
  }

  if (remaining.startsWith("text()")) {
    const { predicates, rest } = parsePredicates(remaining.slice(6));
    return {
      step: { axis, nodeTest: { type: "text" }, predicates },
      rest,
    };
  }

  if (remaining.startsWith("node()")) {
    const { predicates, rest } = parsePredicates(remaining.slice(6));
    return {
      step: { axis, nodeTest: { type: "node" }, predicates },
      rest,
    };
  }

  if (remaining.startsWith("*")) {
    const { predicates, rest } = parsePredicates(remaining.slice(1));
    return {
      step: { axis, nodeTest: { type: "any" }, predicates },
      rest,
    };
  }

  const nameMatch = remaining.match(/^([\w-]+)/);
  if (nameMatch) {
    const { predicates, rest } = parsePredicates(remaining.slice(nameMatch[0].length));
    return {
      step: {
        axis,
        nodeTest: { type: "name", name: nameMatch[1] },
        predicates,
      },
      rest,
    };
  }

  return { step: null, rest: remaining };
}

function parsePredicates(expr: string): { predicates: Predicate[]; rest: string } {
  const predicates: Predicate[] = [];
  let remaining = expr;

  while (remaining.startsWith("[")) {
    const { predicate, rest } = parseSinglePredicate(remaining);
    if (predicate) {
      predicates.push(predicate);
    }
    if (rest === remaining) break;
    remaining = rest;
  }

  return { predicates, rest: remaining };
}

function parseSinglePredicate(expr: string): { predicate: Predicate | null; rest: string } {
  if (!expr.startsWith("[")) {
    return { predicate: null, rest: expr };
  }

  const closeIdx = findMatchingBracket(expr);
  if (closeIdx === -1) {
    return { predicate: null, rest: expr };
  }

  const content = expr.slice(1, closeIdx).trim();
  const rest = expr.slice(closeIdx + 1);

  const predicate = parsePredicateContent(content);
  return { predicate, rest };
}

function findMatchingBracket(expr: string): number {
  let depth = 0;
  let inString: string | null = null;

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];

    if (inString) {
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }

    if (char === "[") {
      depth++;
    } else if (char === "]") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

function parsePredicateContent(content: string): Predicate | null {
  content = content.trim();

  // Position: [1], [2], etc.
  const posMatch = content.match(/^(\d+)$/);
  if (posMatch) {
    return { type: "position", index: parseInt(posMatch[1], 10) };
  }

  // Handle 'or' operator
  const orParts = splitByOperator(content, " or ");
  if (orParts.length > 1) {
    let result = parsePredicateContent(orParts[0]);
    for (let i = 1; i < orParts.length; i++) {
      const right = parsePredicateContent(orParts[i]);
      if (result && right) {
        result = { type: "or", left: result, right };
      }
    }
    return result;
  }

  // Handle 'and' operator
  const andParts = splitByOperator(content, " and ");
  if (andParts.length > 1) {
    let result = parsePredicateContent(andParts[0]);
    for (let i = 1; i < andParts.length; i++) {
      const right = parsePredicateContent(andParts[i]);
      if (result && right) {
        result = { type: "and", left: result, right };
      }
    }
    return result;
  }

  // not() function
  const notMatch = content.match(/^not\s*\(\s*(.+)\s*\)$/);
  if (notMatch) {
    const inner = parsePredicateContent(notMatch[1]);
    if (inner) {
      return { type: "not", inner };
    }
  }

  // Attribute exists: [@href]
  const attrExistsMatch = content.match(/^@([\w-]+)$/);
  if (attrExistsMatch) {
    return { type: "attr-exists", name: attrExistsMatch[1] };
  }

  // Attribute equals: [@class='foo'] or [@class="foo"]
  const attrEqualsMatch = content.match(/^@([\w-]+)\s*=\s*['"]([^'"]*)['"]/);
  if (attrEqualsMatch) {
    return { type: "attr-equals", name: attrEqualsMatch[1], value: attrEqualsMatch[2] };
  }

  // Attribute not equals: [@class!='foo']
  const attrNotEqualsMatch = content.match(/^@([\w-]+)\s*!=\s*['"]([^'"]*)['"]/);
  if (attrNotEqualsMatch) {
    return { type: "attr-not-equals", name: attrNotEqualsMatch[1], value: attrNotEqualsMatch[2] };
  }

  // text()='value'
  const textEqualsMatch = content.match(/^text\(\)\s*=\s*['"]([^'"]*)['"]/);
  if (textEqualsMatch) {
    return { type: "text-equals", value: textEqualsMatch[1] };
  }

  // text()!='value'
  const textNotEqualsMatch = content.match(/^text\(\)\s*!=\s*['"]([^'"]*)['"]/);
  if (textNotEqualsMatch) {
    return { type: "text-not-equals", value: textNotEqualsMatch[1] };
  }

  // normalize-space()='value' or normalize-space(.)='value'
  const normalizeSpaceMatch = content.match(
    /^normalize-space\s*\((?:\.)?\)\s*=\s*['"]([^'"]*)['"]/,
  );
  if (normalizeSpaceMatch) {
    return { type: "normalize-space-equals", value: normalizeSpaceMatch[1] };
  }

  // last()
  if (content === "last()") {
    return { type: "last" };
  }

  // position() comparisons: position() > 1, position() < 3, etc.
  const positionCompareMatch = content.match(/^position\(\)\s*(<|>|<=|>=)\s*(\d+)/);
  if (positionCompareMatch) {
    return {
      type: "position-compare",
      operator: positionCompareMatch[1] as "<" | ">" | "<=" | ">=",
      value: parseInt(positionCompareMatch[2], 10),
    };
  }

  // count(tag) comparisons: count(li) > 3
  const countCompareMatch = content.match(/^count\s*\(\s*([\w-]+)\s*\)\s*(<|>|<=|>=|=)\s*(\d+)/);
  if (countCompareMatch) {
    return {
      type: "count-compare",
      tagName: countCompareMatch[1],
      operator: countCompareMatch[2] as "<" | ">" | "<=" | ">=" | "=",
      value: parseInt(countCompareMatch[3], 10),
    };
  }

  // string-length() comparisons: string-length(text()) > 0
  const stringLengthMatch = content.match(
    /^string-length\s*\(\s*(?:text\(\)|\.|\s*)\s*\)\s*(<|>|<=|>=|=)\s*(\d+)/,
  );
  if (stringLengthMatch) {
    return {
      type: "string-length-compare",
      operator: stringLengthMatch[1] as "<" | ">" | "<=" | ">=" | "=",
      value: parseInt(stringLengthMatch[2], 10),
    };
  }

  // substring(., start, length)='value' or substring(text(), start, length)='value'
  const substringMatch = content.match(
    /^substring\s*\(\s*(?:text\(\)|\.)\s*,\s*(\d+)(?:\s*,\s*(\d+))?\s*\)\s*=\s*['"]([^'"]*)['"]/,
  );
  if (substringMatch) {
    return {
      type: "substring-equals",
      start: parseInt(substringMatch[1], 10),
      length: substringMatch[2] ? parseInt(substringMatch[2], 10) : undefined,
      value: substringMatch[3],
    };
  }

  // substring-before(., 'delimiter')='value'
  const substringBeforeMatch = content.match(
    /^substring-before\s*\(\s*(?:text\(\)|\.)\s*,\s*['"]([^'"]*)['"]\s*\)\s*=\s*['"]([^'"]*)['"]/,
  );
  if (substringBeforeMatch) {
    return {
      type: "substring-before-equals",
      delimiter: substringBeforeMatch[1],
      value: substringBeforeMatch[2],
    };
  }

  // substring-after(., 'delimiter')='value'
  const substringAfterMatch = content.match(
    /^substring-after\s*\(\s*(?:text\(\)|\.)\s*,\s*['"]([^'"]*)['"]\s*\)\s*=\s*['"]([^'"]*)['"]/,
  );
  if (substringAfterMatch) {
    return {
      type: "substring-after-equals",
      delimiter: substringAfterMatch[1],
      value: substringAfterMatch[2],
    };
  }

  // translate(., 'from', 'to')='value'
  const translateMatch = content.match(
    /^translate\s*\(\s*(?:text\(\)|\.)\s*,\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]\s*\)\s*=\s*['"]([^'"]*)['"]/,
  );
  if (translateMatch) {
    return {
      type: "translate-equals",
      from: translateMatch[1],
      to: translateMatch[2],
      value: translateMatch[3],
    };
  }

  // contains(@attr, 'value')
  const containsAttrMatch = content.match(/^contains\s*\(\s*@([\w-]+)\s*,\s*['"]([^'"]*)['"]\s*\)/);
  if (containsAttrMatch) {
    return { type: "attr-contains", name: containsAttrMatch[1], value: containsAttrMatch[2] };
  }

  // contains(text(), 'value') or contains(., 'value')
  const containsTextMatch = content.match(
    /^contains\s*\(\s*(?:text\(\)|\.)\s*,\s*['"]([^'"]*)['"]\s*\)/,
  );
  if (containsTextMatch) {
    return { type: "text-contains", value: containsTextMatch[1] };
  }

  // starts-with(@attr, 'value')
  const startsWithAttrMatch = content.match(
    /^starts-with\s*\(\s*@([\w-]+)\s*,\s*['"]([^'"]*)['"]\s*\)/,
  );
  if (startsWithAttrMatch) {
    return {
      type: "attr-starts-with",
      name: startsWithAttrMatch[1],
      value: startsWithAttrMatch[2],
    };
  }

  // starts-with(text(), 'value') or starts-with(., 'value')
  const startsWithTextMatch = content.match(
    /^starts-with\s*\(\s*(?:text\(\)|\.)\s*,\s*['"]([^'"]*)['"]\s*\)/,
  );
  if (startsWithTextMatch) {
    return { type: "text-starts-with", value: startsWithTextMatch[1] };
  }

  // ends-with(@attr, 'value') - not standard XPath 1.0 but useful
  const endsWithAttrMatch = content.match(
    /^ends-with\s*\(\s*@([\w-]+)\s*,\s*['"]([^'"]*)['"]\s*\)/,
  );
  if (endsWithAttrMatch) {
    return { type: "attr-ends-with", name: endsWithAttrMatch[1], value: endsWithAttrMatch[2] };
  }

  // ends-with(text(), 'value')
  const endsWithTextMatch = content.match(
    /^ends-with\s*\(\s*(?:text\(\)|\.)\s*,\s*['"]([^'"]*)['"]\s*\)/,
  );
  if (endsWithTextMatch) {
    return { type: "text-ends-with", value: endsWithTextMatch[1] };
  }

  // Child element exists: [child-tag]
  const childMatch = content.match(/^([\w-]+)$/);
  if (childMatch) {
    return { type: "has-child", tagName: childMatch[1] };
  }

  return null;
}

function splitByOperator(content: string, operator: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inString: string | null = null;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (inString) {
      current += char;
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      current += char;
      continue;
    }

    if (char === "(" || char === "[") {
      depth++;
      current += char;
      continue;
    }

    if (char === ")" || char === "]") {
      depth--;
      current += char;
      continue;
    }

    if (depth === 0 && content.slice(i, i + operator.length) === operator) {
      parts.push(current.trim());
      current = "";
      i += operator.length - 1;
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function evaluateStep(step: Step, contexts: Node[]): XPathResult[] {
  const results: XPathResult[] = [];

  for (const context of contexts) {
    if (typeof context === "string") continue;

    if (step.axis === "attribute" && step.nodeTest.type === "name") {
      if (context.nodeType === 1) {
        const attr = (context as Element).getAttribute(step.nodeTest.name);
        if (attr !== null) {
          results.push(attr);
        }
      }
    } else {
      const candidates = getCandidates(step.axis, context);
      const matched = filterByNodeTest(candidates, step.nodeTest);
      const filtered = applyPredicates(matched, step.predicates);
      results.push(...filtered);
    }
  }

  return results;
}

function getCandidates(axis: Step["axis"], context: Node): Node[] {
  switch (axis) {
    case "child":
      return Array.from(context.childNodes);

    case "descendant": {
      if (context.nodeType === 9) {
        const doc = context as Document;
        const results: Node[] = [];
        for (const child of Array.from(doc.childNodes)) {
          results.push(child);
          results.push(...getDescendants(child));
        }
        return results;
      }
      return getDescendants(context);
    }

    case "self":
      return [context];

    case "parent":
      return context.parentNode ? [context.parentNode] : [];

    case "attribute":
      return context.nodeType === 1 ? [context] : [];

    case "ancestor": {
      const ancestors: Node[] = [];
      let current = context.parentNode;
      while (current) {
        ancestors.push(current);
        current = current.parentNode;
      }
      return ancestors;
    }

    case "following-sibling": {
      const siblings: Node[] = [];
      let current = context.nextSibling;
      while (current) {
        siblings.push(current);
        current = current.nextSibling;
      }
      return siblings;
    }

    case "preceding-sibling": {
      const siblings: Node[] = [];
      let current = context.previousSibling;
      while (current) {
        siblings.push(current);
        current = current.previousSibling;
      }
      return siblings;
    }

    case "following": {
      const results: Node[] = [];
      let foundContext = false;
      const root = context.ownerDocument || context;

      const walk = (node: Node) => {
        for (const child of Array.from(node.childNodes)) {
          if (foundContext) {
            results.push(child);
            results.push(...getDescendants(child));
          } else if (child === context) {
            foundContext = true;
          } else if (child.contains?.(context)) {
            walk(child);
          }
        }
      };
      walk(root);
      return results;
    }

    case "preceding": {
      const results: Node[] = [];
      let foundContext = false;
      const root = context.ownerDocument || context;

      const walk = (node: Node): boolean => {
        for (const child of Array.from(node.childNodes)) {
          if (child === context) {
            return true;
          }
          if (child.contains?.(context)) {
            const found = walk(child);
            if (found) return true;
          } else if (!foundContext) {
            results.push(child);
            results.push(...getDescendants(child));
          }
        }
        return false;
      };
      walk(root);
      return results;
    }
  }
}

function getDescendants(node: Node): Node[] {
  const results: Node[] = [];
  const walker = (n: Node) => {
    for (const child of Array.from(n.childNodes)) {
      results.push(child);
      walker(child);
    }
  };
  walker(node);
  return results;
}

function filterByNodeTest(nodes: Node[], test: NodeTest): Node[] {
  switch (test.type) {
    case "any":
      return nodes.filter((n) => n.nodeType === 1);

    case "name":
      return nodes.filter(
        (n) => n.nodeType === 1 && (n as Element).tagName.toLowerCase() === test.name.toLowerCase(),
      );

    case "text":
      return nodes.filter((n) => n.nodeType === 3);

    case "node":
      return nodes;
  }
}

function applyPredicates(nodes: Node[], predicates: Predicate[]): Node[] {
  let result = nodes;

  for (const pred of predicates) {
    result = result.filter((node) => evaluatePredicate(node, pred, result));
  }

  return result;
}

function evaluatePredicate(node: Node, pred: Predicate, allNodes: Node[]): boolean {
  switch (pred.type) {
    case "position":
      return allNodes.indexOf(node) === pred.index - 1;

    case "attr-exists":
      return node.nodeType === 1 && (node as Element).hasAttribute(pred.name);

    case "attr-equals":
      return node.nodeType === 1 && (node as Element).getAttribute(pred.name) === pred.value;

    case "text-equals":
      return getNodeText(node) === pred.value;

    case "text-contains":
      return getNodeText(node).includes(pred.value);

    case "attr-contains":
      return (
        node.nodeType === 1 &&
        ((node as Element).getAttribute(pred.name) ?? "").includes(pred.value)
      );

    case "attr-starts-with":
      return (
        node.nodeType === 1 &&
        ((node as Element).getAttribute(pred.name) ?? "").startsWith(pred.value)
      );

    case "attr-ends-with":
      return (
        node.nodeType === 1 &&
        ((node as Element).getAttribute(pred.name) ?? "").endsWith(pred.value)
      );

    case "text-starts-with":
      return getNodeText(node).startsWith(pred.value);

    case "text-ends-with":
      return getNodeText(node).endsWith(pred.value);

    case "has-child":
      if (node.nodeType !== 1) return false;
      return (node as Element).querySelector(pred.tagName) !== null;

    case "not":
      return !evaluatePredicate(node, pred.inner, allNodes);

    case "and":
      return (
        evaluatePredicate(node, pred.left, allNodes) &&
        evaluatePredicate(node, pred.right, allNodes)
      );

    case "or":
      return (
        evaluatePredicate(node, pred.left, allNodes) ||
        evaluatePredicate(node, pred.right, allNodes)
      );

    case "attr-not-equals":
      return node.nodeType === 1 && (node as Element).getAttribute(pred.name) !== pred.value;

    case "text-not-equals":
      return getNodeText(node) !== pred.value;

    case "normalize-space-equals":
      return normalizeSpace(getNodeText(node)) === pred.value;

    case "last":
      return allNodes.indexOf(node) === allNodes.length - 1;

    case "position-compare":
      return compareNumbers(allNodes.indexOf(node) + 1, pred.operator, pred.value);

    case "count-compare": {
      if (node.nodeType !== 1) return false;
      const count = (node as Element).querySelectorAll(pred.tagName).length;
      return compareNumbers(count, pred.operator, pred.value);
    }

    case "string-length-compare": {
      const length = getNodeText(node).length;
      return compareNumbers(length, pred.operator, pred.value);
    }

    case "substring-equals": {
      const text = getNodeText(node);
      const start = pred.start - 1;
      const sub =
        pred.length !== undefined ? text.slice(start, start + pred.length) : text.slice(start);
      return sub === pred.value;
    }

    case "substring-before-equals": {
      const text = getNodeText(node);
      const idx = text.indexOf(pred.delimiter);
      const before = idx === -1 ? "" : text.slice(0, idx);
      return before === pred.value;
    }

    case "substring-after-equals": {
      const text = getNodeText(node);
      const idx = text.indexOf(pred.delimiter);
      const after = idx === -1 ? "" : text.slice(idx + pred.delimiter.length);
      return after === pred.value;
    }

    case "translate-equals": {
      const text = getNodeText(node);
      let result = text;
      for (let i = 0; i < pred.from.length; i++) {
        const replacement = i < pred.to.length ? pred.to[i] : "";
        result = result.split(pred.from[i]).join(replacement);
      }
      return result === pred.value;
    }
  }
}

function getNodeText(node: Node): string {
  return node.textContent?.trim() ?? "";
}

function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function compareNumbers(
  left: number,
  operator: "<" | ">" | "<=" | ">=" | "=",
  right: number,
): boolean {
  switch (operator) {
    case "<":
      return left < right;
    case ">":
      return left > right;
    case "<=":
      return left <= right;
    case ">=":
      return left >= right;
    case "=":
      return left === right;
  }
}
