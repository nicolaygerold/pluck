export function extractRegex(pattern: RegExp | string, text: string): string[] {
  const regex = typeof pattern === "string" ? new RegExp(pattern, "g") : pattern;

  const isGlobal = regex.flags.includes("g");
  const globalRegex = isGlobal ? regex : new RegExp(regex.source, regex.flags + "g");

  const hasGroups = regex.source.includes("(") && !regex.source.match(/^\(\?:/);

  if (hasGroups) {
    const results: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = globalRegex.exec(text)) !== null) {
      for (let i = 1; i < match.length; i++) {
        if (match[i] !== undefined) {
          results.push(match[i]);
        }
      }
    }
    return results;
  }

  const matches = text.match(globalRegex);
  return matches ?? [];
}

export function flatten<T>(arr: (T | T[])[]): T[] {
  return arr.flat() as T[];
}
