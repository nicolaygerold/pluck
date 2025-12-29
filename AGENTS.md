# Agents

## Commands

- `bun run lint` - Lint with oxlint
- `bun run format` - Format with oxfmt
- `bun run format:check` - Check formatting without writing
- `bun run test` - Run bun tests
- `bun run check:all` - Run all checks (test, lint, format:check)
- `bun run check:fix` - Auto-fix format and lint issues, then run tests

## Testing

Tests live in `tests/` directory.

### AAA Pattern

```text
Arrange  — prepare inputs and dependencies
Act      — run the unit under test
Assert   — verify outcome and side effects
```

### Key principles

- No business logic in tests — assert outcomes, don't re-implement logic
- Minimize mocking — only mock external systems (network, DB, time)
- Test public behavior, not internals
- One concern per test
- Tests must be deterministic and fast

### Mock vs real

| Mock                     | Real / Fake                  |
| ------------------------ | ---------------------------- |
| External APIs            | Domain logic                 |
| System time / randomness | Pure functions               |
|                          | Databases (fake/local)       |

## Reference Libraries

Use the **librarian** tool to explore these libraries for implementation patterns:

### Python parsel (github.com/scrapy/parsel)
- `parsel/selector.py` - Core Selector/SelectorList classes, `.get()/.getall()` pattern
- `parsel/csstranslator.py` - CSS pseudo-element (`::text`, `::attr()`) implementation

### Go goquery (github.com/PuerkitoBio/goquery)
- `type.go` - Selection type, graceful error handling
- `traversal.go` - DOM traversal, chaining patterns

### Example queries for librarian:
```
"How does parsel implement the ::text pseudo-element in csstranslator.py?"
"Show me how goquery handles invalid CSS selectors gracefully"
"What is the SelectorList implementation pattern in parsel?"
```

## Project Context

Pluck is an LLM-native HTML selector library. See `docs/plan.md` for full design.

Key principles:
- **Predictable API**: `.get()` for single, `.getall()` for multiple
- **Feedback-first**: `.ok` property tells if selector matched
- **Pseudo-elements**: `::text` and `::attr(name)` for intuitive extraction
