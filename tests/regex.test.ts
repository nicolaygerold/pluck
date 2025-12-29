import { describe, expect, test } from "bun:test";
import { extractRegex } from "../src/regex";
import { pluck } from "../src";

describe("extractRegex utility", () => {
  describe("no capturing groups", () => {
    test("extracts all matches", () => {
      const result = extractRegex(/\d+/, "a1b2c3");
      expect(result).toEqual(["1", "2", "3"]);
    });

    test("returns empty array when no match", () => {
      const result = extractRegex(/\d+/, "abc");
      expect(result).toEqual([]);
    });

    test("works with string pattern", () => {
      const result = extractRegex("\\d+", "a1b2c3");
      expect(result).toEqual(["1", "2", "3"]);
    });

    test("handles global flag", () => {
      const result = extractRegex(/[a-z]/g, "a1b2c3");
      expect(result).toEqual(["a", "b", "c"]);
    });

    test("handles non-global regex by adding global flag", () => {
      const result = extractRegex(/[a-z]/, "a1b2c3");
      expect(result).toEqual(["a", "b", "c"]);
    });
  });

  describe("single capturing group", () => {
    test("extracts captured group values", () => {
      const result = extractRegex(/\$(\d+)/, "Price: $10, Sale: $20");
      expect(result).toEqual(["10", "20"]);
    });

    test("extracts decimal values", () => {
      const result = extractRegex(/\$(\d+\.\d+)/, "$99.99 and $49.50");
      expect(result).toEqual(["99.99", "49.50"]);
    });
  });

  describe("multiple capturing groups", () => {
    test("extracts all groups from single match", () => {
      const result = extractRegex(/(\d{4})-(\d{2})-(\d{2})/, "Date: 2024-01-15");
      expect(result).toEqual(["2024", "01", "15"]);
    });

    test("extracts all groups from multiple matches", () => {
      const result = extractRegex(/(\w+):(\d+)/, "a:1 b:2 c:3");
      expect(result).toEqual(["a", "1", "b", "2", "c", "3"]);
    });

    test("handles optional groups", () => {
      const result = extractRegex(/(\w+)(?::(\d+))?/, "a:1 b");
      expect(result).toEqual(["a", "1", "b"]);
    });
  });

  describe("non-capturing groups", () => {
    test("non-capturing group with capturing group extracts captured part", () => {
      const result = extractRegex(/item-(\d+)/, "item-1 item-2");
      expect(result).toEqual(["1", "2"]);
    });

    test("only non-capturing groups returns full match", () => {
      const result = extractRegex(/(?:item-)\d+/, "item-1 item-2");
      expect(result).toEqual(["item-1", "item-2"]);
    });
  });

  describe("edge cases", () => {
    test("empty string returns empty array", () => {
      const result = extractRegex(/\d+/, "");
      expect(result).toEqual([]);
    });

    test("handles special regex characters", () => {
      const result = extractRegex(/\$\d+\.\d+/, "Price: $99.99");
      expect(result).toEqual(["$99.99"]);
    });

    test("handles unicode", () => {
      const result = extractRegex(/\p{L}+/gu, "hello 世界");
      expect(result).toEqual(["hello", "世界"]);
    });

    test("handles multiline text", () => {
      const result = extractRegex(/^\d+/gm, "1 first\n2 second\n3 third");
      expect(result).toEqual(["1", "2", "3"]);
    });
  });
});

describe("Selector.re()", () => {
  describe("basic extraction", () => {
    test("extracts numbers from text", () => {
      const doc = pluck("<p>Items: 5, 10, 15</p>");
      const numbers = doc.css("p::text").re(/\d+/).getall();
      expect(numbers).toEqual(["5", "10", "15"]);
    });

    test("extracts prices with dollar sign", () => {
      const doc = pluck("<p>Price: $99.99, Sale: $79.99</p>");
      const prices = doc
        .css("p::text")
        .re(/\$\d+\.\d+/)
        .getall();
      expect(prices).toEqual(["$99.99", "$79.99"]);
    });

    test("extracts capturing group values", () => {
      const doc = pluck("<p>Price: $99.99</p>");
      const amount = doc
        .css("p::text")
        .re(/\$(\d+\.\d+)/)
        .get();
      expect(amount).toBe("99.99");
    });
  });

  describe("chaining with CSS", () => {
    test("works after css selector", () => {
      const doc = pluck("<div><span class='price'>$50</span></div>");
      const price = doc.css(".price::text").re(/\d+/).get();
      expect(price).toBe("50");
    });

    test("works with ::attr pseudo-element", () => {
      const doc = pluck('<a href="/product/123/details">Link</a>');
      const id = doc
        .css("a::attr(href)")
        .re(/\/product\/(\d+)/)
        .get();
      expect(id).toBe("123");
    });
  });

  describe("chaining with XPath", () => {
    test("works after xpath selector", () => {
      const doc = pluck("<div><p>Order #12345</p></div>");
      const orderNum = doc
        .xpath("//p::text")
        .re(/#(\d+)/)
        .get();
      expect(orderNum).toBe("12345");
    });

    test("works with xpath attribute extraction", () => {
      const doc = pluck('<img src="/images/photo-456.jpg"/>');
      const id = doc
        .xpath("//img/@src")
        .re(/photo-(\d+)/)
        .get();
      expect(id).toBe("456");
    });
  });

  describe("multiple elements", () => {
    test("extracts from all matched elements", () => {
      const doc = pluck(`
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
        </ul>
      `);
      const numbers = doc.css("li::text").re(/\d+/).getall();
      expect(numbers).toEqual(["1", "2", "3"]);
    });

    test("extracts multiple matches per element", () => {
      const doc = pluck(`
        <div>
          <p>A: 1, 2</p>
          <p>B: 3, 4</p>
        </div>
      `);
      const numbers = doc.css("p::text").re(/\d+/).getall();
      expect(numbers).toEqual(["1", "2", "3", "4"]);
    });
  });

  describe("MappedSelector interface", () => {
    test(".get() returns first match", () => {
      const doc = pluck("<p>a1b2c3</p>");
      expect(doc.css("p::text").re(/\d+/).get()).toBe("1");
    });

    test(".get(default) returns default when no match", () => {
      const doc = pluck("<p>no numbers</p>");
      expect(doc.css("p::text").re(/\d+/).get("N/A")).toBe("N/A");
    });

    test(".getall() returns all matches", () => {
      const doc = pluck("<p>a1b2c3</p>");
      expect(doc.css("p::text").re(/\d+/).getall()).toEqual(["1", "2", "3"]);
    });

    test(".ok is true when matches exist", () => {
      const doc = pluck("<p>number: 42</p>");
      expect(doc.css("p::text").re(/\d+/).ok).toBe(true);
    });

    test(".ok is false when no matches", () => {
      const doc = pluck("<p>no numbers</p>");
      expect(doc.css("p::text").re(/\d+/).ok).toBe(false);
    });
  });

  describe("string patterns", () => {
    test("accepts string pattern", () => {
      const doc = pluck("<p>test@example.com</p>");
      const email = doc.css("p::text").re("\\w+@\\w+\\.\\w+").get();
      expect(email).toBe("test@example.com");
    });

    test("string pattern with capturing group", () => {
      const doc = pluck("<p>ID: ABC-123</p>");
      const id = doc.css("p::text").re("ABC-(\\d+)").get();
      expect(id).toBe("123");
    });
  });
});

describe("Selector.re_first()", () => {
  test("returns first match", () => {
    const doc = pluck("<p>1, 2, 3</p>");
    expect(doc.css("p::text").re_first(/\d+/)).toBe("1");
  });

  test("returns first captured group", () => {
    const doc = pluck("<p>Price: $99</p>");
    expect(doc.css("p::text").re_first(/\$(\d+)/)).toBe("99");
  });

  test("returns default when no match", () => {
    const doc = pluck("<p>no numbers</p>");
    expect(doc.css("p::text").re_first(/\d+/, "none")).toBe("none");
  });

  test("returns null when no match and no default", () => {
    const doc = pluck("<p>no numbers</p>");
    expect(doc.css("p::text").re_first(/\d+/)).toBeNull();
  });

  test("works with string pattern", () => {
    const doc = pluck("<p>abc123</p>");
    expect(doc.css("p::text").re_first("\\d+")).toBe("123");
  });
});

describe("real-world patterns", () => {
  test("extract product IDs from URLs", () => {
    const doc = pluck(`
      <a href="/products/123">Product 1</a>
      <a href="/products/456">Product 2</a>
    `);
    const ids = doc
      .css("a::attr(href)")
      .re(/\/products\/(\d+)/)
      .getall();
    expect(ids).toEqual(["123", "456"]);
  });

  test("extract dates", () => {
    const doc = pluck("<p>Published: 2024-01-15</p>");
    const parts = doc
      .css("p::text")
      .re(/(\d{4})-(\d{2})-(\d{2})/)
      .getall();
    expect(parts).toEqual(["2024", "01", "15"]);
  });

  test("extract email addresses", () => {
    const doc = pluck("<p>Contact: alice@example.com or bob@test.org</p>");
    const emails = doc
      .css("p::text")
      .re(/[\w.]+@[\w.]+\.\w+/)
      .getall();
    expect(emails).toEqual(["alice@example.com", "bob@test.org"]);
  });

  test("extract phone numbers", () => {
    const doc = pluck("<p>Call: 555-123-4567 or 555-987-6543</p>");
    const phones = doc
      .css("p::text")
      .re(/\d{3}-\d{3}-\d{4}/)
      .getall();
    expect(phones).toEqual(["555-123-4567", "555-987-6543"]);
  });

  test("extract hashtags", () => {
    const doc = pluck("<p>Trending: #javascript #typescript #webdev</p>");
    const tags = doc
      .css("p::text")
      .re(/#(\w+)/)
      .getall();
    expect(tags).toEqual(["javascript", "typescript", "webdev"]);
  });

  test("extract version numbers", () => {
    const doc = pluck("<span>Version: v2.5.1</span>");
    const version = doc
      .css("span::text")
      .re(/v(\d+\.\d+\.\d+)/)
      .get();
    expect(version).toBe("2.5.1");
  });

  test("extract currency amounts", () => {
    const doc = pluck("<td>Total: €1,234.56</td>");
    const amount = doc
      .css("td::text")
      .re(/[€$£]([\d,]+\.\d{2})/)
      .get();
    expect(amount).toBe("1,234.56");
  });

  test("scrape table data with regex cleanup", () => {
    const doc = pluck(`
      <table>
        <tr><td>Stock: 42 units</td><td>Price: $19.99</td></tr>
        <tr><td>Stock: 15 units</td><td>Price: $29.99</td></tr>
      </table>
    `);

    const rows = doc
      .css("tr")
      .toArray()
      .map((row) => ({
        stock: row.css("td:first-child::text").re_first(/(\d+)/) ?? "0",
        price: row.css("td:last-child::text").re_first(/\$([\d.]+)/) ?? "0",
      }));

    expect(rows).toEqual([
      { stock: "42", price: "19.99" },
      { stock: "15", price: "29.99" },
    ]);
  });
});
