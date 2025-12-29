export interface ParsedSelector {
  query: string;
  extract: "node" | "text" | "attr";
  attrName?: string;
}

export function parseXPathPseudo(query: string): ParsedSelector {
  const textMatch = query.match(/^(.+?)::text$/);
  if (textMatch) {
    return {
      query: textMatch[1],
      extract: "text",
    };
  }

  const attrMatch = query.match(/^(.+?)::attr\(([^)]+)\)$/);
  if (attrMatch) {
    return {
      query: attrMatch[1],
      extract: "attr",
      attrName: attrMatch[2],
    };
  }

  return {
    query,
    extract: "node",
  };
}

export function parseCSSPseudo(query: string): ParsedSelector {
  const textMatch = query.match(/^(.+?)::text$/);
  if (textMatch) {
    return {
      query: textMatch[1],
      extract: "text",
    };
  }

  const attrMatch = query.match(/^(.+?)::attr\(([^)]+)\)$/);
  if (attrMatch) {
    return {
      query: attrMatch[1],
      extract: "attr",
      attrName: attrMatch[2],
    };
  }

  return {
    query,
    extract: "node",
  };
}

export function extractValue(
  node: Node,
  extract: "node" | "text" | "attr",
  attrName?: string,
): string | null {
  if (extract === "text") {
    const text = node.textContent?.trim() ?? null;
    return text === "" ? null : text;
  }

  if (extract === "attr" && attrName) {
    if (node.nodeType === 1) {
      return (node as Element).getAttribute(attrName);
    }
    return null;
  }

  if (node.nodeType === 1) {
    return (node as Element).outerHTML;
  }

  if (node.nodeType === 2) {
    return (node as Attr).value;
  }

  return node.textContent?.trim() ?? null;
}
