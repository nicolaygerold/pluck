# Pluck - LLM-Native HTML Selector Library

## Vision

A TypeScript library for extracting data from HTML that is **LLM-native**: easy to generate code for, intuitive interfaces, and clear feedback on extraction success/failure.

## Research Summary

Analyzed best-in-class libraries:
- **Python parsel** (Scrapy): Best extraction API (`.get()/.getall()`), pseudo-elements (`::text`, `::attr()`)
- **Python lxml**: Low-level power, direct XPath
- **Go goquery**: CSS-only simplicity, graceful silent failures, fluent chaining

## Design Principles

### 1. LLM-Native First
- **Predictable patterns**: Same method names, same return types
- **Self-documenting**: Method names describe what they do
- **Minimal API surface**: Fewer methods = easier to generate correct code
- **Clear feedback**: Know when extraction hits or misses

### 2. Extraction Over Navigation
- Optimized for "get data out" not "traverse tree"
- Results are always strings or arrays of strings (not DOM nodes)

### 3. Graceful Degradation
- Empty results, not errors, for missing elements
- Invalid selectors return empty results (like goquery)
- Explicit `.ok` property to check if anything matched

---

## Core API Design

### Entry Point

```typescript
import { pluck } from 'pluck'

const sel = pluck(html)
```

### Selector Class

```typescript
class Selector {
  // === Core Extraction (from parsel) ===
  get(): string | null          // First match or null
  getall(): string[]            // All matches
  
  // === Query Methods ===
  css(selector: string): Selector       // CSS selector
  xpath(query: string): Selector        // XPath query
  
  // === Quick Accessors ===
  text(): string                // Combined text content
  attr(name: string): string | null     // Attribute value
  html(): string | null         // Inner HTML
  
  // === Feedback Properties (LLM-native) ===
  ok: boolean                   // Did the selector match anything?
  count: number                 // Number of matches
  
  // === Iteration ===
  each(fn: (sel: Selector, i: number) => void): void
  map<T>(fn: (sel: Selector, i: number) => T): T[]
  [Symbol.iterator](): Iterator<Selector>
  
  // === Chaining ===
  first(): Selector
  last(): Selector
  eq(index: number): Selector
}
```

### Pseudo-Elements (from parsel)

CSS selectors support intuitive pseudo-elements:

```typescript
sel.css('h1::text').get()           // → "Page Title"
sel.css('a::attr(href)').getall()   // → ["/page1", "/page2"]
sel.css('p::text').getall()         // → ["para 1", "para 2"]
```

---

## Usage Examples

### Basic Extraction

```typescript
const sel = pluck(html)

// Get page title
const title = sel.css('h1::text').get()

// Get all links
const links = sel.css('a::attr(href)').getall()

// Check if element exists
if (sel.css('.error-message').ok) {
  console.log('Error found:', sel.css('.error-message::text').get())
}
```

### Iteration

```typescript
// Extract structured data
const products = sel.css('.product').map(p => ({
  name: p.css('.name::text').get(),
  price: p.css('.price::text').get(),
  url: p.css('a::attr(href)').get(),
}))
```

### XPath for Complex Queries

```typescript
// XPath when CSS isn't enough
const items = sel.xpath('//div[contains(@class, "item")]/text()').getall()

// Context-relative XPath
sel.css('.container').each(container => {
  const link = container.xpath('.//a/@href').get()
})
```

---

## LLM Feedback System

### Hit/Miss Feedback

Every selector provides feedback about extraction success:

```typescript
interface ExtractionResult {
  ok: boolean        // Did we match anything?
  count: number      // How many elements matched?
  selector: string   // The selector that was used
}

const result = sel.css('.product-title')
console.log(result.ok)      // true/false
console.log(result.count)   // 5
console.log(result.selector) // ".product-title"
```

### Debug Mode

```typescript
const sel = pluck(html, { debug: true })

// Logs extraction attempts:
// [pluck] css('.title') → 1 match
// [pluck] css('.missing') → 0 matches
// [pluck] xpath('//div') → 12 matches
```

### Structured Feedback for LLMs

```typescript
// Get extraction report
const report = sel.report()
// {
//   attempted: [
//     { selector: '.title', type: 'css', matches: 1 },
//     { selector: '.missing', type: 'css', matches: 0 },
//   ],
//   html_preview: '<html>...',  // First 500 chars
// }
```

---

## Implementation Plan

### Phase 1: Core Foundation
- [ ] Set up project with TypeScript + Bun
- [ ] Choose DOM parser (linkedom > happy-dom for XPath)
- [ ] Implement `Selector` class with basic CSS support
- [ ] Implement `.get()`, `.getall()`, `.ok`, `.count`

### Phase 2: Pseudo-Elements
- [ ] Implement `::text` pseudo-element
- [ ] Implement `::attr(name)` pseudo-element
- [ ] CSS-to-modified-CSS translator

### Phase 3: XPath Support
- [ ] Integrate xpath library
- [ ] Fix namespace issues (local-name() wrapper)
- [ ] Implement attribute extraction fixes
- [ ] Context-relative queries

### Phase 4: LLM Feedback
- [ ] Debug mode with logging
- [ ] Extraction report generation
- [ ] Selector validation with helpful errors

### Phase 5: Polish
- [ ] Performance optimization
- [ ] Documentation
- [ ] Examples for common scraping patterns

---

## DOM Parser Decision

| Option | XPath Support | Performance | Accuracy |
|--------|--------------|-------------|----------|
| happy-dom | ⚠️ Broken | Fast | Good |
| linkedom | ✅ Better | Fast | Good |
| jsdom | ✅ Full | Slower | Excellent |

**Recommendation**: Start with `linkedom`, fall back to `jsdom` if issues arise.

---

## API Comparison

| Feature | pluck | parsel | goquery |
|---------|-------|--------|---------|
| `.get()` | ✅ | ✅ | ❌ |
| `.getall()` | ✅ | ✅ | ❌ |
| `::text` | ✅ | ✅ | ❌ |
| `::attr()` | ✅ | ✅ | ❌ |
| `.ok` feedback | ✅ | ❌ | ❌ |
| Debug mode | ✅ | ❌ | ❌ |
| CSS selectors | ✅ | ✅ | ✅ |
| XPath | ✅ | ✅ | ❌ |

---

## Reference Libraries

For implementation inspiration, use the librarian to explore:

- **github.com/scrapy/parsel** - Python selector library
  - `parsel/selector.py` - Core Selector/SelectorList classes
  - `parsel/csstranslator.py` - CSS pseudo-element handling
  
- **github.com/PuerkitoBio/goquery** - Go jQuery-like library
  - `type.go` - Selection type and methods
  - `traversal.go` - DOM traversal patterns
  
- **github.com/nicotine-plus/nicotine-plus** - Real-world parsel usage patterns
