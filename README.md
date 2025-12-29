# pluck

LLM-native HTML selector library. Extract data from HTML with XPath and CSS selectors.

```bash
bun add pluck
```

## Quick Start

```typescript
import { pluck } from "pluck";

const html = `
  <div class="product">
    <h1>Wireless Headphones</h1>
    <span class="price">$99.99</span>
    <a href="/buy/123">Buy now</a>
  </div>
`;

const doc = pluck(html);

// Extract text
const title = doc.css("h1::text").get();
// → "Wireless Headphones"

// Extract attribute
const link = doc.xpath("//a/@href").get();
// → "/buy/123"

// Check if element exists
if (doc.css(".discount").ok) {
  console.log("On sale!");
}
```

## API Reference

### Entry Point

```typescript
import { pluck } from "pluck";

const doc = pluck(html);              // Parse HTML string
const doc = pluck(html, { debug: true }); // Enable debug logging
```

### Query Methods

```typescript
doc.css("selector")      // CSS selector
doc.xpath("//expression") // XPath expression
```

Both return a `Selector` that can be chained.

### Extraction

```typescript
.get()              // First match or null
.get("default")     // First match or default value
.getall()           // All matches as string[]

.text()             // Combined text content
.attr("name")       // Attribute value or null
.html()             // Inner HTML or null
```

### Feedback

```typescript
.ok                 // true if selector matched anything
.count              // Number of matches
.selector           // The selector string used

.result()           // { ok: true, value, count } or { ok: false, selector }
```

### Chaining

```typescript
.or(fallback)       // Use fallback selector if no match
.map(fn)            // Transform values: .map(s => s.toUpperCase())
.first()            // First match only
.last()             // Last match only
.eq(n)              // Nth match (0-indexed)
```

### Iteration

```typescript
.each((sel, i) => {})  // Iterate with callback
.toArray()             // Convert to Selector[]

for (const item of doc.css("li")) {
  console.log(item.text());
}
```

### Pseudo-Elements

Extract text or attributes directly in selectors:

```typescript
// CSS
doc.css("h1::text").get()           // Text content
doc.css("a::attr(href)").get()      // Attribute value

// XPath
doc.xpath("//h1::text").get()       // Text content  
doc.xpath("//a::attr(href)").get()  // Attribute value
doc.xpath("//a/@href").get()        // Also works (native XPath)
```

## XPath Cheatsheet

### Axes

```typescript
//div                 // All div elements anywhere
/div                  // Direct child div
.//div                // Descendant div from current context
..                    // Parent element
ancestor::div         // Ancestor div elements
following-sibling::p  // Following p siblings
preceding-sibling::p  // Preceding p siblings
following::p          // All following p elements
preceding::p          // All preceding p elements
```

### Predicates

```typescript
//div[1]                      // First div
//div[last()]                 // Last div
//div[position() > 1]         // All except first
//a[@href]                    // Has href attribute
//a[@class='active']          // Exact attribute match
//a[@class!='hidden']         // Attribute not equal
//a[contains(@class, 'btn')]  // Attribute contains
//a[starts-with(@href, '/')]  // Attribute starts with
//a[ends-with(@href, '.pdf')] // Attribute ends with
//p[text()='Hello']           // Exact text match
//p[contains(text(), 'Hello')] // Text contains
//div[span]                   // Has child span
//div[count(p) > 2]           // Has more than 2 p children
```

### String Functions

```typescript
//p[normalize-space()='Hello']           // Ignore whitespace
//p[string-length() > 0]                 // Non-empty text
//p[substring(., 1, 5)='Hello']          // First 5 chars
//p[substring-before(., ':')='Price']    // Before delimiter
//p[substring-after(., ': ')='$99']      // After delimiter
//p[translate(., 'ABC', 'abc')='hello']  // Case conversion
```

### Logical Operators

```typescript
//a[@class='x' and @id='y']   // Both conditions
//a[@class='x' or @class='y'] // Either condition
//a[not(contains(@class, 'hidden'))] // Negation
//h1 | //h2                   // Union (combine results)
```

## CSS Cheatsheet

```typescript
div                    // Element
.class                 // Class
#id                    // ID
div.class              // Element with class
div > p                // Direct child
div p                  // Descendant
div + p                // Adjacent sibling
div ~ p                // General sibling
[href]                 // Has attribute
[href="/page"]         // Attribute equals
[href^="/"]            // Starts with
[href$=".pdf"]         // Ends with
[href*="example"]      // Contains
[class~="btn"]         // Contains word
```

## Common Patterns

### Tables

```typescript
const doc = pluck(html);

// Get all rows
const rows = doc.xpath("//table//tr").toArray();

// Get specific cell (row 2, column 3)
const cell = doc.xpath("//table//tr[2]/td[3]::text").get();

// Get column values
const prices = doc.xpath("//table//tr/td[2]::text").getall();

// Get row by content
const row = doc.xpath("//tr[td[text()='Product A']]");
```

### Lists

```typescript
// All list items
const items = doc.css("ul li::text").getall();

// Nested lists
const nested = doc.xpath("//ul/li/ul/li::text").getall();
```

### Forms

```typescript
// Input value
const value = doc.css("input[name='email']::attr(value)").get();

// All form fields
doc.css("form input").each((input) => {
  const name = input.attr("name");
  const value = input.attr("value");
});

// Select options
const options = doc.xpath("//select[@name='country']/option/@value").getall();
```

### Links

```typescript
// All links
const hrefs = doc.css("a::attr(href)").getall();

// External links
const external = doc.xpath("//a[starts-with(@href, 'http')]/@href").getall();

// Links with specific text
const login = doc.xpath("//a[text()='Login']/@href").get();
```

### Definition Lists

```typescript
// Get value after specific term
const price = doc.xpath("//dt[text()='Price']/following-sibling::dd[1]::text").get();
```

### Structured Data

```typescript
// Extract product cards
const products = doc.css(".product").map((p) => ({
  name: p.css(".name::text").get(),
  price: p.css(".price::text").get(),
  url: p.css("a::attr(href)").get(),
})).getall();
```

## CSS vs XPath

| Use CSS When | Use XPath When |
|--------------|----------------|
| Simple element selection | Text content matching |
| Class/ID selection | Attribute contains/starts-with |
| Direct children | Sibling navigation |
| Attribute presence | Parent/ancestor traversal |
| | Position-based selection |
| | Complex predicates |

**Rule of thumb:** Start with CSS, switch to XPath when you need text matching or axis navigation.

## Error Handling

```typescript
// Check before access
const price = doc.css(".price::text");
if (price.ok) {
  console.log(price.get());
}

// Default values
const stock = doc.css(".stock::text").get("In stock");

// Fallback selectors
const title = doc
  .css("h1::text")
  .or(doc.css(".title::text"))
  .or(doc.css("title::text"))
  .get();

// Structured result
const result = doc.css(".price::text").result();
if (result.ok) {
  console.log(result.value, result.count);
} else {
  console.log("Selector failed:", result.selector);
}

// Invalid selectors return ok: false (no exceptions)
const invalid = doc.xpath("//[broken");
invalid.ok;    // false
invalid.count; // 0
invalid.get(); // null
```

## LLM Tips

Patterns that work well for code generation:

```typescript
// ✅ Good: Explicit extraction
doc.css("h1::text").get()
doc.xpath("//a/@href").get()

// ✅ Good: Check existence
if (doc.css(".error").ok) { ... }

// ✅ Good: Safe defaults  
doc.css(".price::text").get("N/A")

// ✅ Good: Structured extraction
doc.css(".item").map(item => ({
  title: item.css(".title::text").get(),
  link: item.css("a::attr(href)").get(),
})).getall()

// ❌ Avoid: Chaining without checks
doc.css(".maybe-missing").css(".child::text").get()

// ✅ Better: Check at each step
const parent = doc.css(".maybe-missing");
const text = parent.ok ? parent.css(".child::text").get() : null;
```

## License

MIT
