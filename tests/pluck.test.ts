import { describe, expect, test } from "bun:test";
import { pluck, type Logger } from "../src";

const html = `
  <div class="product">
    <h1>Wireless Headphones</h1>
    <span class="price">$99.99</span>
    <ul class="features">
      <li>Noise cancelling</li>
      <li>40hr battery</li>
    </ul>
    <a href="/buy/123">Buy now</a>
  </div>
`;

describe("pluck", () => {
  describe("xpath", () => {
    test("extracts text with ::text pseudo-element", () => {
      const doc = pluck(html);
      const title = doc.xpath("//h1::text").get();
      expect(title).toBe("Wireless Headphones");
    });

    test("extracts multiple values with getall()", () => {
      const doc = pluck(html);
      const features = doc.xpath("//ul[@class='features']/li::text").getall();
      expect(features).toEqual(["Noise cancelling", "40hr battery"]);
    });

    test("extracts attribute with ::attr() pseudo-element", () => {
      const doc = pluck(html);
      const href = doc.xpath("//a::attr(href)").get();
      expect(href).toBe("/buy/123");
    });

    test("extracts attribute directly from xpath", () => {
      const doc = pluck(html);
      const href = doc.xpath("//a/@href").get();
      expect(href).toBe("/buy/123");
    });

    test("returns ok: false for invalid xpath with unclosed predicate", () => {
      const doc = pluck(html);
      const sel = doc.xpath("//[invalid-xpath");
      expect(sel.ok).toBe(false);
      expect(sel.count).toBe(0);
      expect(sel.get()).toBe(null);
    });

    test("returns ok: false for xpath with invalid syntax", () => {
      const doc = pluck(html);
      const sel = doc.xpath("//div[");
      expect(sel.ok).toBe(false);
      expect(sel.count).toBe(0);
    });

    test("returns ok: false for xpath starting with invalid chars", () => {
      const doc = pluck(html);
      const sel = doc.xpath("[invalid");
      expect(sel.ok).toBe(false);
      expect(sel.count).toBe(0);
    });
  });

  describe("css", () => {
    test("extracts text with ::text pseudo-element", () => {
      const doc = pluck(html);
      const title = doc.css("h1::text").get();
      expect(title).toBe("Wireless Headphones");
    });

    test("extracts attribute with ::attr() pseudo-element", () => {
      const doc = pluck(html);
      const href = doc.css("a::attr(href)").get();
      expect(href).toBe("/buy/123");
    });

    test("extracts multiple values", () => {
      const doc = pluck(html);
      const features = doc.css(".features li::text").getall();
      expect(features).toEqual(["Noise cancelling", "40hr battery"]);
    });
  });

  describe("feedback", () => {
    test(".ok is true when selector matches", () => {
      const doc = pluck(html);
      const result = doc.css("h1");
      expect(result.ok).toBe(true);
    });

    test(".ok is false when selector does not match", () => {
      const doc = pluck(html);
      const result = doc.css(".nonexistent");
      expect(result.ok).toBe(false);
    });

    test(".count returns number of matches", () => {
      const doc = pluck(html);
      expect(doc.css("li").count).toBe(2);
      expect(doc.css(".nonexistent").count).toBe(0);
    });
  });

  describe("default values", () => {
    test(".get(default) returns default when no match", () => {
      const doc = pluck(html);
      const stock = doc.css(".stock::text").get("In stock");
      expect(stock).toBe("In stock");
    });

    test(".get(default) returns value when match exists", () => {
      const doc = pluck(html);
      const title = doc.css("h1::text").get("Unknown");
      expect(title).toBe("Wireless Headphones");
    });
  });

  describe("chaining", () => {
    test(".or() returns fallback when no match", () => {
      const doc = pluck(html);
      const price = doc.css(".sale-price::text").or(doc.css(".price::text")).get();
      expect(price).toBe("$99.99");
    });

    test(".or() returns original when match exists", () => {
      const doc = pluck(html);
      const price = doc.css(".price::text").or(doc.css(".sale-price::text")).get();
      expect(price).toBe("$99.99");
    });
  });

  describe("map", () => {
    test(".map() transforms values", () => {
      const doc = pluck(html);
      const price = doc
        .css(".price::text")
        .map((s) => parseFloat(s.replace("$", "")))
        .get();
      expect(price).toBe(99.99);
    });

    test(".map().getall() transforms all values", () => {
      const doc = pluck(html);
      const lengths = doc
        .css(".features li::text")
        .map((s) => s.length)
        .getall();
      expect(lengths).toEqual([16, 12]);
    });
  });

  describe("iteration", () => {
    test("each() iterates over matches", () => {
      const doc = pluck(html);
      const texts: string[] = [];
      doc.css("li").each((sel) => {
        texts.push(sel.text());
      });
      expect(texts).toEqual(["Noise cancelling", "40hr battery"]);
    });

    test("for...of iteration works", () => {
      const doc = pluck(html);
      const texts: string[] = [];
      for (const sel of doc.css("li")) {
        texts.push(sel.text());
      }
      expect(texts).toEqual(["Noise cancelling", "40hr battery"]);
    });

    test("toArray() returns array of selectors", () => {
      const doc = pluck(html);
      const items = doc.css("li").toArray();
      expect(items.length).toBe(2);
      expect(items[0].text()).toBe("Noise cancelling");
    });
  });

  describe("positional", () => {
    test(".first() returns first match", () => {
      const doc = pluck(html);
      expect(doc.css("li").first().text()).toBe("Noise cancelling");
    });

    test(".last() returns last match", () => {
      const doc = pluck(html);
      expect(doc.css("li").last().text()).toBe("40hr battery");
    });

    test(".eq() returns nth match", () => {
      const doc = pluck(html);
      expect(doc.css("li").eq(1).text()).toBe("40hr battery");
    });

    test(".eq() returns empty selector for out of bounds", () => {
      const doc = pluck(html);
      expect(doc.css("li").eq(99).ok).toBe(false);
    });
  });

  describe("accessors", () => {
    test(".text() returns combined text content", () => {
      const doc = pluck(html);
      expect(doc.css("h1").text()).toBe("Wireless Headphones");
    });

    test(".text(false) preserves whitespace", () => {
      const doc = pluck("<div>  spaced text  </div>");
      expect(doc.xpath("//div").text(false)).toBe("  spaced text  ");
    });

    test(".text(true) trims whitespace (default)", () => {
      const doc = pluck("<div>  spaced text  </div>");
      expect(doc.xpath("//div").text(true)).toBe("spaced text");
      expect(doc.xpath("//div").text()).toBe("spaced text");
    });

    test(".attr() returns attribute value", () => {
      const doc = pluck(html);
      expect(doc.css("a").attr("href")).toBe("/buy/123");
    });

    test(".html() returns inner HTML", () => {
      const doc = pluck(html);
      const innerHtml = doc.css("h1").html();
      expect(innerHtml).toBe("Wireless Headphones");
    });
  });

  describe("xpath advanced", () => {
    const advancedHtml = `
      <div class="container" id="main">
        <a href="/page1" class="link active">Home</a>
        <a href="/page2" class="link">About</a>
        <a href="https://external.com" class="link external">External</a>
        <p class="intro">Welcome to the site</p>
        <p class="content">Main content here</p>
        <div class="nested"><span>Nested text</span></div>
      </div>
    `;

    test("multiple predicates [@class][@id]", () => {
      const doc = pluck(advancedHtml);
      const result = doc.xpath("//div[@class='container'][@id='main']::text").get();
      expect(result).toContain("Home");
    });

    test("text()='value' exact match", () => {
      const doc = pluck(advancedHtml);
      const href = doc.xpath("//a[text()='Home']/@href").get();
      expect(href).toBe("/page1");
    });

    test("contains(text(), 'value')", () => {
      const doc = pluck(advancedHtml);
      const text = doc.xpath("//p[contains(text(), 'Welcome')]::text").get();
      expect(text).toBe("Welcome to the site");
    });

    test("contains(@attr, 'value')", () => {
      const doc = pluck(advancedHtml);
      const links = doc.xpath("//a[contains(@class, 'link')]/@href").getall();
      expect(links).toEqual(["/page1", "/page2", "https://external.com"]);
    });

    test("starts-with(@attr, 'value')", () => {
      const doc = pluck(advancedHtml);
      const links = doc.xpath("//a[starts-with(@href, '/')]/@href").getall();
      expect(links).toEqual(["/page1", "/page2"]);
    });

    test("starts-with(text(), 'value')", () => {
      const doc = pluck(advancedHtml);
      const text = doc.xpath("//p[starts-with(text(), 'Main')]::text").get();
      expect(text).toBe("Main content here");
    });

    test("ends-with(@attr, 'value')", () => {
      const doc = pluck(advancedHtml);
      const link = doc.xpath("//a[ends-with(@href, '.com')]/@href").get();
      expect(link).toBe("https://external.com");
    });

    test("not() function", () => {
      const doc = pluck(advancedHtml);
      const links = doc.xpath("//a[not(contains(@class, 'external'))]/@href").getall();
      expect(links).toEqual(["/page1", "/page2"]);
    });

    test("and operator", () => {
      const doc = pluck(advancedHtml);
      const link = doc
        .xpath("//a[contains(@class, 'link') and contains(@class, 'active')]/@href")
        .get();
      expect(link).toBe("/page1");
    });

    test("or operator", () => {
      const doc = pluck(advancedHtml);
      const texts = doc.xpath("//p[@class='intro' or @class='content']::text").getall();
      expect(texts).toEqual(["Welcome to the site", "Main content here"]);
    });

    test("has child element [span]", () => {
      const doc = pluck(advancedHtml);
      const result = doc.xpath("//div[@class='nested'][span]::text").get();
      expect(result).toBe("Nested text");
    });
  });

  describe("xpath axes", () => {
    const axesHtml = `
      <dl>
        <dt>Price</dt>
        <dd>$99</dd>
        <dt>Color</dt>
        <dd>Blue</dd>
      </dl>
      <table>
        <tr><td>A</td><td>B</td><td>C</td></tr>
        <tr><td>1</td><td>2</td><td>3</td></tr>
      </table>
      <div class="wrapper"><span class="inner">Deep</span></div>
    `;

    test("following-sibling::", () => {
      const doc = pluck(axesHtml);
      const price = doc.xpath("//dt[text()='Price']/following-sibling::dd::text").get();
      expect(price).toBe("$99");
    });

    test("preceding-sibling::", () => {
      const doc = pluck(axesHtml);
      const label = doc.xpath("//dd[text()='Blue']/preceding-sibling::dt::text").get();
      expect(label).toBe("Color");
    });

    test("ancestor::", () => {
      const doc = pluck(axesHtml);
      const wrapper = doc.xpath("//span[@class='inner']/ancestor::div/@class").get();
      expect(wrapper).toBe("wrapper");
    });
  });

  describe("xpath functions extended", () => {
    const fnHtml = `
      <ul>
        <li>First</li>
        <li>Second</li>
        <li>Third</li>
        <li>   Spaced   </li>
      </ul>
      <div class="items">
        <span>A</span><span>B</span><span>C</span>
      </div>
      <p class="empty"></p>
      <p class="filled">Has content</p>
    `;

    test("last()", () => {
      const doc = pluck(fnHtml);
      const last = doc.xpath("//li[last()]::text").get();
      expect(last).toBe("Spaced");
    });

    test("position() > n", () => {
      const doc = pluck(fnHtml);
      const items = doc.xpath("//li[position() > 1]::text").getall();
      expect(items).toEqual(["Second", "Third", "Spaced"]);
    });

    test("position() < n", () => {
      const doc = pluck(fnHtml);
      const items = doc.xpath("//li[position() < 3]::text").getall();
      expect(items).toEqual(["First", "Second"]);
    });

    test("normalize-space()='value'", () => {
      const doc = pluck(fnHtml);
      const item = doc.xpath("//li[normalize-space()='Spaced']::text").get();
      expect(item).toBe("Spaced");
    });

    test("count() comparison", () => {
      const doc = pluck(fnHtml);
      const div = doc.xpath("//div[count(span) > 2]/@class").get();
      expect(div).toBe("items");
    });

    test("string-length() > 0", () => {
      const doc = pluck(fnHtml);
      const filled = doc.xpath("//p[string-length() > 0]/@class").get();
      expect(filled).toBe("filled");
    });

    test("@attr != 'value'", () => {
      const doc = pluck(fnHtml);
      const notEmpty = doc.xpath("//p[@class != 'empty']/@class").get();
      expect(notEmpty).toBe("filled");
    });

    test("text() != 'value'", () => {
      const doc = pluck(fnHtml);
      const items = doc.xpath("//li[text() != 'First']::text").getall();
      expect(items).toEqual(["Second", "Third", "Spaced"]);
    });
  });

  describe("xpath string functions", () => {
    const stringHtml = `
      <ul>
        <li>hello-world</li>
        <li>foo-bar-baz</li>
        <li>ABC123</li>
      </ul>
    `;

    test("substring() with start", () => {
      const doc = pluck(stringHtml);
      const match = doc.xpath("//li[substring(., 1, 5)='hello']::text").get();
      expect(match).toBe("hello-world");
    });

    test("substring() without length", () => {
      const doc = pluck(stringHtml);
      const match = doc.xpath("//li[substring(., 7)='world']::text").get();
      expect(match).toBe("hello-world");
    });

    test("substring-before()", () => {
      const doc = pluck(stringHtml);
      const match = doc.xpath("//li[substring-before(., '-')='foo']::text").get();
      expect(match).toBe("foo-bar-baz");
    });

    test("substring-after()", () => {
      const doc = pluck(stringHtml);
      const match = doc.xpath("//li[substring-after(., 'hello-')='world']::text").get();
      expect(match).toBe("hello-world");
    });

    test("translate() for case conversion", () => {
      const doc = pluck(stringHtml);
      const match = doc.xpath("//li[translate(., 'ABC', 'abc')='abc123']::text").get();
      expect(match).toBe("ABC123");
    });
  });

  describe("xpath following/preceding axes", () => {
    const docHtml = `
      <div>
        <p id="first">First paragraph</p>
        <p id="second">Second paragraph</p>
        <span id="middle">Middle span</span>
        <p id="third">Third paragraph</p>
        <p id="fourth">Fourth paragraph</p>
      </div>
    `;

    test("following:: gets all following nodes", () => {
      const doc = pluck(docHtml);
      const ids = doc.xpath("//span[@id='middle']/following::p/@id").getall();
      expect(ids).toEqual(["third", "fourth"]);
    });

    test("preceding:: gets all preceding nodes", () => {
      const doc = pluck(docHtml);
      const ids = doc.xpath("//span[@id='middle']/preceding::p/@id").getall();
      expect(ids).toEqual(["first", "second"]);
    });
  });

  describe("xpath union", () => {
    const unionHtml = `
      <article>
        <h1>Title</h1>
        <h2>Subtitle</h2>
        <p>Paragraph</p>
      </article>
    `;

    test("union operator |", () => {
      const doc = pluck(unionHtml);
      const headings = doc.xpath("//h1::text | //h2::text").getall();
      expect(headings).toEqual(["Title", "Subtitle"]);
    });

    test("union with ::text", () => {
      const doc = pluck(unionHtml);
      const texts = doc.xpath("//h1::text | //p::text").getall();
      expect(texts).toEqual(["Title", "Paragraph"]);
    });
  });

  describe("result()", () => {
    test("returns success result when matched", () => {
      const doc = pluck(html);
      const result = doc.css("h1::text").result();
      expect(result).toEqual({
        ok: true,
        value: "Wireless Headphones",
        count: 1,
      });
    });

    test("returns failure result when not matched", () => {
      const doc = pluck(html);
      const result = doc.css(".missing::text").result();
      expect(result).toEqual({
        ok: false,
        selector: ".missing::text",
      });
    });
  });
});

// ============================================================================
// COMPLEX TEST CASES
// ============================================================================

const complexTableHtml = `
<html>
<head><title>Data Dashboard</title></head>
<body>
  <div id="app" data-version="2.5.1" data-env="production">
    <header class="main-header sticky">
      <nav id="primary-nav" role="navigation" aria-label="Main menu">
        <ul class="nav-list">
          <li class="nav-item active"><a href="/" class="nav-link" data-track="home">Home</a></li>
          <li class="nav-item"><a href="/products" class="nav-link" data-track="products">Products</a></li>
          <li class="nav-item dropdown">
            <a href="#" class="nav-link dropdown-toggle" data-track="services">Services</a>
            <ul class="dropdown-menu">
              <li><a href="/services/consulting">Consulting</a></li>
              <li><a href="/services/support">Support</a></li>
              <li><a href="/services/training">Training</a></li>
            </ul>
          </li>
          <li class="nav-item"><a href="https://external.example.com" class="nav-link external" target="_blank" rel="noopener">Partners</a></li>
        </ul>
      </nav>
    </header>

    <main id="content">
      <section class="hero" data-testid="hero-section">
        <h1 class="hero-title">Welcome to <span class="brand">Acme Corp</span></h1>
        <p class="hero-subtitle">Building the <em>future</em> of <strong>technology</strong></p>
      </section>

      <section class="data-section" id="quarterly-report">
        <h2>Q4 2024 Report</h2>
        <table id="sales-data" class="data-table sortable">
          <thead>
            <tr>
              <th scope="col" data-sort="region">Region</th>
              <th scope="col" data-sort="q1">Q1</th>
              <th scope="col" data-sort="q2">Q2</th>
              <th scope="col" data-sort="q3">Q3</th>
              <th scope="col" data-sort="q4">Q4</th>
              <th scope="col" data-sort="total">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr data-region="north" class="row-odd">
              <td class="region-cell"><span class="region-name">North</span><span class="region-code">NA-01</span></td>
              <td class="numeric">$12,500</td>
              <td class="numeric">$15,200</td>
              <td class="numeric highlight">$18,900</td>
              <td class="numeric">$22,100</td>
              <td class="numeric total">$68,700</td>
            </tr>
            <tr data-region="south" class="row-even">
              <td class="region-cell"><span class="region-name">South</span><span class="region-code">SA-02</span></td>
              <td class="numeric">$9,800</td>
              <td class="numeric">$11,400</td>
              <td class="numeric">$13,200</td>
              <td class="numeric highlight">$16,500</td>
              <td class="numeric total">$50,900</td>
            </tr>
            <tr data-region="east" class="row-odd">
              <td class="region-cell"><span class="region-name">East</span><span class="region-code">EA-03</span></td>
              <td class="numeric highlight">$21,000</td>
              <td class="numeric">$19,800</td>
              <td class="numeric">$23,400</td>
              <td class="numeric">$25,600</td>
              <td class="numeric total">$89,800</td>
            </tr>
            <tr data-region="west" class="row-even">
              <td class="region-cell"><span class="region-name">West</span><span class="region-code">WE-04</span></td>
              <td class="numeric">$17,300</td>
              <td class="numeric highlight">$20,100</td>
              <td class="numeric">$19,500</td>
              <td class="numeric">$21,800</td>
              <td class="numeric total">$78,700</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="totals-row">
              <td>Grand Total</td>
              <td class="numeric">$60,600</td>
              <td class="numeric">$66,500</td>
              <td class="numeric">$75,000</td>
              <td class="numeric">$86,000</td>
              <td class="numeric grand-total">$288,100</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section class="form-section" id="contact">
        <h2>Contact Us</h2>
        <form id="contact-form" action="/api/contact" method="POST" data-validate="true">
          <fieldset>
            <legend>Personal Information</legend>
            <div class="form-group required">
              <label for="name">Full Name</label>
              <input type="text" id="name" name="name" placeholder="John Doe" required aria-required="true" />
            </div>
            <div class="form-group required">
              <label for="email">Email Address</label>
              <input type="email" id="email" name="email" placeholder="john@example.com" required aria-required="true" data-validate="email" />
            </div>
            <div class="form-group">
              <label for="phone">Phone (optional)</label>
              <input type="tel" id="phone" name="phone" placeholder="+1 (555) 123-4567" pattern="[+]?[0-9\\s\\-()]*" />
            </div>
          </fieldset>
          <fieldset>
            <legend>Message Details</legend>
            <div class="form-group">
              <label for="subject">Subject</label>
              <select id="subject" name="subject">
                <option value="">Select a subject...</option>
                <option value="sales">Sales Inquiry</option>
                <option value="support">Technical Support</option>
                <option value="billing">Billing Question</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-group required">
              <label for="message">Message</label>
              <textarea id="message" name="message" rows="5" required aria-required="true" placeholder="Tell us how we can help..."></textarea>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" name="newsletter" value="yes" />
                Subscribe to newsletter
              </label>
            </div>
          </fieldset>
          <div class="form-actions">
            <button type="reset" class="btn btn-secondary">Clear</button>
            <button type="submit" class="btn btn-primary" data-action="submit">Send Message</button>
          </div>
        </form>
      </section>

      <aside class="sidebar" role="complementary">
        <div class="widget recent-posts">
          <h3>Recent Posts</h3>
          <article class="post-preview" data-post-id="101">
            <h4><a href="/blog/101">Understanding XPath Axes</a></h4>
            <time datetime="2024-12-15">December 15, 2024</time>
            <p class="excerpt">Learn about the different axes in XPath and how to use them...</p>
            <div class="meta">
              <span class="author">By Jane Smith</span>
              <span class="read-time">5 min read</span>
            </div>
          </article>
          <article class="post-preview featured" data-post-id="102">
            <h4><a href="/blog/102">CSS Selectors Deep Dive</a></h4>
            <time datetime="2024-12-10">December 10, 2024</time>
            <p class="excerpt">A comprehensive guide to CSS selectors and combinators...</p>
            <div class="meta">
              <span class="author">By John Doe</span>
              <span class="read-time">8 min read</span>
            </div>
          </article>
          <article class="post-preview" data-post-id="103">
            <h4><a href="/blog/103">HTML Parsing Techniques</a></h4>
            <time datetime="2024-12-05">December 5, 2024</time>
            <p class="excerpt">Best practices for parsing HTML in modern web scraping...</p>
            <div class="meta">
              <span class="author">By Jane Smith</span>
              <span class="read-time">6 min read</span>
            </div>
          </article>
        </div>
      </aside>
    </main>

    <footer id="site-footer">
      <div class="footer-grid">
        <div class="footer-col">
          <h4>Company</h4>
          <ul>
            <li><a href="/about">About Us</a></li>
            <li><a href="/careers">Careers</a></li>
            <li><a href="/press">Press</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Resources</h4>
          <ul>
            <li><a href="/docs">Documentation</a></li>
            <li><a href="/api">API Reference</a></li>
            <li><a href="/blog">Blog</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Legal</h4>
          <ul>
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/terms">Terms of Service</a></li>
            <li><a href="/cookies">Cookie Policy</a></li>
          </ul>
        </div>
      </div>
      <p class="copyright">&copy; 2024 Acme Corp. All rights reserved.</p>
    </footer>
  </div>
</body>
</html>
`;

const deeplyNestedHtml = `
<div class="level-1" id="root">
  <div class="level-2" data-depth="2">
    <div class="level-3" data-depth="3">
      <div class="level-4" data-depth="4">
        <div class="level-5" data-depth="5">
          <div class="level-6 target" data-depth="6">
            <span class="deep-content">Found at depth 6</span>
          </div>
        </div>
      </div>
    </div>
    <div class="level-3 sibling" data-depth="3">
      <p>Sibling content</p>
    </div>
  </div>
  <div class="level-2 second" data-depth="2">
    <span class="shallow">Shallow content</span>
  </div>
</div>
`;

const specialCharsHtml = `
<div id="special-chars">
  <p class="math-formula">E = mc²</p>
  <p class="currency">Price: €1,234.56</p>
  <p class="unicode">日本語テキスト</p>
  <p class="emoji">Status: ✓ Complete 🎉</p>
  <p class="html-entities">&lt;script&gt;alert('XSS')&lt;/script&gt;</p>
  <p class="quotes">He said "Hello" and she said 'Hi'</p>
  <a href="/path?foo=bar&baz=qux&special=<>">Link with params</a>
  <div data-json='{"key": "value", "num": 42}'>JSON data attr</div>
  <pre class="code-block">function test() {
    return x < y && y > z;
  }</pre>
  <p class="whitespace">   Lots   of    spaces   </p>
  <p class="newlines">Line 1
Line 2
Line 3</p>
  <p class="tabs">Tab	separated	content</p>
</div>
`;

const mixedContentHtml = `
<article id="mixed-content">
  <p>This is <strong>bold</strong> and <em>italic</em> and <strong><em>both</em></strong>.</p>
  <p class="inline-code">Use the <code>pluck()</code> function to parse HTML.</p>
  <p>Visit our <a href="https://example.com">website</a> for more <a href="/info">information</a>.</p>
  <div class="mixed">
    Text before
    <span>span text</span>
    text after
    <div>nested div</div>
    more text
  </div>
  <ul class="nested-list">
    <li>Item 1
      <ul>
        <li>Sub-item 1.1</li>
        <li>Sub-item 1.2
          <ul>
            <li>Deep item 1.2.1</li>
          </ul>
        </li>
      </ul>
    </li>
    <li>Item 2</li>
  </ul>
</article>
`;

describe("pluck complex", () => {
  describe("complex xpath - table navigation", () => {
    test("select specific table cell by row and column", () => {
      const doc = pluck(complexTableHtml);
      const q3North = doc
        .xpath("//table[@id='sales-data']//tr[@data-region='north']/td[4]::text")
        .get();
      expect(q3North).toBe("$18,900");
    });

    test("select all values in a specific column", () => {
      const doc = pluck(complexTableHtml);
      const totals = doc
        .xpath("//table[@id='sales-data']/tbody/tr/td[contains(@class, 'total')]::text")
        .getall();
      expect(totals).toEqual(["$68,700", "$50,900", "$89,800", "$78,700"]);
    });

    test("select table headers", () => {
      const doc = pluck(complexTableHtml);
      const headers = doc.xpath("//table[@id='sales-data']//th::text").getall();
      expect(headers).toEqual(["Region", "Q1", "Q2", "Q3", "Q4", "Total"]);
    });

    test("select highlighted cells", () => {
      const doc = pluck(complexTableHtml);
      const highlighted = doc.xpath("//td[contains(@class, 'highlight')]::text").getall();
      expect(highlighted).toEqual(["$18,900", "$16,500", "$21,000", "$20,100"]);
    });

    test("select row by region code", () => {
      const doc = pluck(complexTableHtml);
      const eastRegion = doc
        .xpath("//tr[@data-region='east']/td[contains(@class, 'total')]::text")
        .get();
      expect(eastRegion).toBe("$89,800");
    });

    test("grand total from footer", () => {
      const doc = pluck(complexTableHtml);
      const grandTotal = doc.xpath("//tfoot//td[contains(@class, 'grand-total')]::text").get();
      expect(grandTotal).toBe("$288,100");
    });
  });

  describe("complex xpath - form elements", () => {
    test("select all required fields", () => {
      const doc = pluck(complexTableHtml);
      const requiredLabels = doc.xpath("//div[contains(@class, 'required')]/label::text").getall();
      expect(requiredLabels).toEqual(["Full Name", "Email Address", "Message"]);
    });

    test("select input by type", () => {
      const doc = pluck(complexTableHtml);
      const emailInput = doc.xpath("//input[@type='email']/@placeholder").get();
      expect(emailInput).toBe("john@example.com");
    });

    test("select all option values from select", () => {
      const doc = pluck(complexTableHtml);
      const options = doc.xpath("//select[@id='subject']/option[not(@value='')]/@value").getall();
      expect(options).toEqual(["sales", "support", "billing", "other"]);
    });

    test("select form action", () => {
      const doc = pluck(complexTableHtml);
      const action = doc.xpath("//form[@id='contact-form']/@action").get();
      expect(action).toBe("/api/contact");
    });

    test("select fieldset legends", () => {
      const doc = pluck(complexTableHtml);
      const legends = doc.xpath("//form//legend::text").getall();
      expect(legends).toEqual(["Personal Information", "Message Details"]);
    });

    test("select button by data attribute", () => {
      const doc = pluck(complexTableHtml);
      const submitBtn = doc.xpath("//button[@data-action='submit']::text").get();
      expect(submitBtn).toBe("Send Message");
    });
  });

  describe("complex xpath - navigation and links", () => {
    test("select all external links", () => {
      const doc = pluck(complexTableHtml);
      const externalLinks = doc
        .xpath("//a[contains(@class, 'external') or starts-with(@href, 'http')]/@href")
        .getall();
      expect(externalLinks).toContain("https://external.example.com");
    });

    test("select dropdown menu items", () => {
      const doc = pluck(complexTableHtml);
      const dropdownItems = doc.xpath("//ul[@class='dropdown-menu']//a::text").getall();
      expect(dropdownItems).toEqual(["Consulting", "Support", "Training"]);
    });

    test("select active nav item", () => {
      const doc = pluck(complexTableHtml);
      const activeItem = doc.xpath("//li[contains(@class, 'active')]/a::text").get();
      expect(activeItem).toBe("Home");
    });

    test("select all nav links with tracking", () => {
      const doc = pluck(complexTableHtml);
      const trackedLinks = doc.xpath("//a[@data-track]/@data-track").getall();
      expect(trackedLinks).toEqual(["home", "products", "services"]);
    });

    test("select footer links by section", () => {
      const doc = pluck(complexTableHtml);
      const legalLinks = doc.css(".footer-col:has(h4:contains('Legal')) a::attr(href)").getall();
      expect(legalLinks).toEqual(["/privacy", "/terms", "/cookies"]);
    });
  });

  describe("complex xpath - blog posts and articles", () => {
    test("select featured post title", () => {
      const doc = pluck(complexTableHtml);
      const featuredTitle = doc.xpath("//article[contains(@class, 'featured')]//h4/a::text").get();
      expect(featuredTitle).toBe("CSS Selectors Deep Dive");
    });

    test("select all post dates as datetime", () => {
      const doc = pluck(complexTableHtml);
      const dates = doc
        .xpath(
          "//article[@class='post-preview' or contains(@class, 'post-preview')]//time/@datetime",
        )
        .getall();
      expect(dates).toEqual(["2024-12-15", "2024-12-10", "2024-12-05"]);
    });

    test("select posts by author using css", () => {
      const doc = pluck(complexTableHtml);
      const janesPosts: string[] = [];
      for (const article of doc.css("article.post-preview")) {
        const author = article.css(".author::text").get();
        if (author?.includes("Jane Smith")) {
          const title = article.css("h4 a::text").get();
          if (title) janesPosts.push(title);
        }
      }
      expect(janesPosts).toEqual(["Understanding XPath Axes", "HTML Parsing Techniques"]);
    });

    test("select post excerpts", () => {
      const doc = pluck(complexTableHtml);
      const excerpts = doc.xpath("//article//p[@class='excerpt']::text").getall();
      expect(excerpts.length).toBe(3);
      expect(excerpts[0]).toContain("XPath");
    });

    test("select post by id", () => {
      const doc = pluck(complexTableHtml);
      const post = doc.xpath("//article[@data-post-id='102']//h4/a::text").get();
      expect(post).toBe("CSS Selectors Deep Dive");
    });
  });

  describe("complex xpath - deeply nested structures", () => {
    test("find element at specific depth", () => {
      const doc = pluck(deeplyNestedHtml);
      const content = doc.xpath("//div[@data-depth='6']//span::text").get();
      expect(content).toBe("Found at depth 6");
    });

    test("find element with specific class at any depth", () => {
      const doc = pluck(deeplyNestedHtml);
      const target = doc.xpath("//div[contains(@class, 'target')]::text").get();
      expect(target).toContain("Found at depth 6");
    });

    test("count elements at each level", () => {
      const doc = pluck(deeplyNestedHtml);
      const level2Count = doc.xpath("//div[@class='level-1']/div").count;
      const level3Count = doc.xpath("//div[contains(@class, 'level-3')]").count;
      expect(level2Count).toBe(2);
      expect(level3Count).toBe(2);
    });

    test("find sibling elements", () => {
      const doc = pluck(deeplyNestedHtml);
      const sibling = doc.xpath("//div[@class='level-3 sibling']/p::text").get();
      expect(sibling).toBe("Sibling content");
    });
  });

  describe("complex xpath - compound predicates", () => {
    test("multiple AND conditions", () => {
      const doc = pluck(complexTableHtml);
      const result = doc
        .xpath(
          "//tr[@data-region='north' and contains(@class, 'row-odd')]/td[@class='numeric total']::text",
        )
        .get();
      expect(result).toBe("$68,700");
    });

    test("multiple OR conditions", () => {
      const doc = pluck(complexTableHtml);
      const regions = doc
        .xpath(
          "//tr[@data-region='north' or @data-region='south']//span[@class='region-name']::text",
        )
        .getall();
      expect(regions).toEqual(["North", "South"]);
    });

    test("NOT with contains", () => {
      const doc = pluck(complexTableHtml);
      const nonHighlighted = doc
        .xpath(
          "//tr[@data-region='north']/td[@class='numeric'][not(contains(@class, 'highlight'))]::text",
        )
        .getall();
      expect(nonHighlighted).toEqual(["$12,500", "$15,200", "$22,100"]);
    });

    test("combined AND, OR, NOT", () => {
      const doc = pluck(complexTableHtml);
      const links = doc
        .xpath(
          "//a[(contains(@class, 'nav-link') or contains(@class, 'external')) and not(contains(@class, 'dropdown-toggle'))]/@href",
        )
        .getall();
      expect(links).toContain("/");
      expect(links).toContain("https://external.example.com");
    });
  });

  describe("complex xpath - positional predicates", () => {
    test("first row of table body", () => {
      const doc = pluck(complexTableHtml);
      const firstRegion = doc
        .xpath("//table[@id='sales-data']/tbody/tr[1]//span[@class='region-name']::text")
        .get();
      expect(firstRegion).toBe("North");
    });

    test("last row of table body", () => {
      const doc = pluck(complexTableHtml);
      const lastRegion = doc
        .xpath("//table[@id='sales-data']/tbody/tr[4]//span[@class='region-name']::text")
        .get();
      expect(lastRegion).toBe("West");
    });

    test("second column of each row", () => {
      const doc = pluck(complexTableHtml);
      const q1Values = doc.xpath("//table[@id='sales-data']/tbody/tr/td[2]::text").getall();
      expect(q1Values).toEqual(["$12,500", "$9,800", "$21,000", "$17,300"]);
    });

    test("first element with class", () => {
      const doc = pluck(complexTableHtml);
      const firstPost = doc
        .xpath(
          "//article[@class='post-preview' or contains(@class, 'post-preview')][1]//h4/a::text",
        )
        .get();
      expect(firstPost).toBe("Understanding XPath Axes");
    });
  });

  describe("complex css - combinators", () => {
    test("direct child combinator", () => {
      const doc = pluck(complexTableHtml);
      const directChildren = doc.css("#sales-data > tbody > tr::attr(data-region)").getall();
      expect(directChildren).toEqual(["north", "south", "east", "west"]);
    });

    test("adjacent sibling combinator", () => {
      const doc = pluck(complexTableHtml);
      const afterHeader = doc.css("header + main").ok;
      expect(afterHeader).toBe(true);
    });

    test("general sibling combinator", () => {
      const doc = pluck(complexTableHtml);
      const sections = doc.css(".hero ~ section").count;
      expect(sections).toBe(2);
    });

    test("descendant combinator with multiple levels", () => {
      const doc = pluck(complexTableHtml);
      const deepLinks = doc.css("nav ul li ul li a::text").getall();
      expect(deepLinks).toEqual(["Consulting", "Support", "Training"]);
    });
  });

  describe("complex css - attribute selectors", () => {
    test("attribute starts with", () => {
      const doc = pluck(complexTableHtml);
      const internalLinks = doc.css("a[href^='/']::attr(href)").getall();
      expect(internalLinks).toContain("/");
      expect(internalLinks).toContain("/products");
    });

    test("attribute ends with", () => {
      const doc = pluck(complexTableHtml);
      const externalLinks = doc.css("a[href$='.com']::attr(href)").getall();
      expect(externalLinks).toEqual(["https://external.example.com"]);
    });

    test("attribute contains", () => {
      const doc = pluck(complexTableHtml);
      const navLinks = doc.css("a[class*='nav-link']::text").getall();
      expect(navLinks).toContain("Home");
      expect(navLinks).toContain("Products");
    });

    test("attribute contains word", () => {
      const doc = pluck(complexTableHtml);
      const btnPrimary = doc.css("button[class~='btn-primary']::text").get();
      expect(btnPrimary).toBe("Send Message");
    });

    test("multiple attribute selectors", () => {
      const doc = pluck(complexTableHtml);
      const requiredEmail = doc.css("input[type='email'][required]::attr(placeholder)").get();
      expect(requiredEmail).toBe("john@example.com");
    });
  });

  describe("complex css - pseudo-elements with combinators", () => {
    test("nested text extraction", () => {
      const doc = pluck(complexTableHtml);
      const heroTitle = doc.css(".hero-title::text").get();
      expect(heroTitle).toContain("Welcome to");
    });

    test("attribute from deeply nested element", () => {
      const doc = pluck(complexTableHtml);
      const postIds = doc.css(".sidebar article::attr(data-post-id)").getall();
      expect(postIds).toEqual(["101", "102", "103"]);
    });

    test("text from specific child", () => {
      const doc = pluck(complexTableHtml);
      const brandName = doc.css(".hero-title .brand::text").get();
      expect(brandName).toBe("Acme Corp");
    });
  });

  describe("edge cases - special characters", () => {
    test("unicode text extraction", () => {
      const doc = pluck(specialCharsHtml);
      const japanese = doc.css(".unicode::text").get();
      expect(japanese).toBe("日本語テキスト");
    });

    test("emoji text extraction", () => {
      const doc = pluck(specialCharsHtml);
      const emoji = doc.css(".emoji::text").get();
      expect(emoji).toBe("Status: ✓ Complete 🎉");
    });

    test("html entities as text", () => {
      const doc = pluck(specialCharsHtml);
      const entities = doc.css(".html-entities::text").get();
      expect(entities).toBe("<script>alert('XSS')</script>");
    });

    test("quotes in text", () => {
      const doc = pluck(specialCharsHtml);
      const quotes = doc.css(".quotes::text").get();
      expect(quotes).toBe("He said \"Hello\" and she said 'Hi'");
    });

    test("url with query params", () => {
      const doc = pluck(specialCharsHtml);
      const href = doc.css("#special-chars a::attr(href)").get();
      expect(href).toBe("/path?foo=bar&baz=qux&special=<>");
    });

    test("json in data attribute", () => {
      const doc = pluck(specialCharsHtml);
      const json = doc.css("[data-json]::attr(data-json)").get();
      expect(json).toBe('{"key": "value", "num": 42}');
    });

    test("multiline text", () => {
      const doc = pluck(specialCharsHtml);
      const newlines = doc.css(".newlines::text").get();
      expect(newlines).toContain("Line 1");
      expect(newlines).toContain("Line 3");
    });

    test("preserves internal whitespace after trim", () => {
      const doc = pluck(specialCharsHtml);
      const whitespace = doc.css(".whitespace::text").get();
      expect(whitespace).toBe("Lots   of    spaces");
    });
  });

  describe("edge cases - mixed content", () => {
    test("text with inline elements", () => {
      const doc = pluck(mixedContentHtml);
      const text = doc.css("#mixed-content > p:first-of-type").text();
      expect(text).toBe("This is bold and italic and both.");
    });

    test("code element text", () => {
      const doc = pluck(mixedContentHtml);
      const code = doc.css(".inline-code code::text").get();
      expect(code).toBe("pluck()");
    });

    test("multiple links in paragraph", () => {
      const doc = pluck(mixedContentHtml);
      const links = doc.css("#mixed-content > p:nth-of-type(3) a::attr(href)").getall();
      expect(links).toEqual(["https://example.com", "/info"]);
    });

    test("mixed text and elements", () => {
      const doc = pluck(mixedContentHtml);
      const mixed = doc.css(".mixed").text();
      expect(mixed).toContain("Text before");
      expect(mixed).toContain("span text");
      expect(mixed).toContain("text after");
    });

    test("deeply nested list items", () => {
      const doc = pluck(mixedContentHtml);
      const deepItem = doc.xpath("//ul[@class='nested-list']//ul//ul/li::text").get();
      expect(deepItem).toBe("Deep item 1.2.1");
    });

    test("count all list items at all levels", () => {
      const doc = pluck(mixedContentHtml);
      const allItems = doc.css(".nested-list li").count;
      expect(allItems).toBe(5);
    });
  });

  describe("edge cases - empty and missing", () => {
    test("empty selector returns false for .ok", () => {
      const doc = pluck("<div></div>");
      expect(doc.css(".missing").ok).toBe(false);
    });

    test("empty html", () => {
      const doc = pluck("");
      expect(doc.css("*").ok).toBe(false);
    });

    test("get() returns null for no match", () => {
      const doc = pluck("<p>test</p>");
      expect(doc.css(".missing::text").get()).toBeNull();
    });

    test("getall() returns empty array for no match", () => {
      const doc = pluck("<p>test</p>");
      expect(doc.css(".missing::text").getall()).toEqual([]);
    });

    test("chained selectors on empty result", () => {
      const doc = pluck("<div></div>");
      const result = doc.css(".missing").css(".also-missing").xpath("//nothing");
      expect(result.ok).toBe(false);
      expect(result.count).toBe(0);
    });

    test("iteration on empty result", () => {
      const doc = pluck("<div></div>");
      const items: string[] = [];
      for (const sel of doc.css(".missing")) {
        items.push(sel.text());
      }
      expect(items).toEqual([]);
    });

    test("map on empty result", () => {
      const doc = pluck("<div></div>");
      const mapped = doc
        .css(".missing::text")
        .map((x) => x.toUpperCase())
        .getall();
      expect(mapped).toEqual([]);
    });
  });

  describe("edge cases - whitespace only nodes", () => {
    test("element with only whitespace", () => {
      const doc = pluck("<p>   </p>");
      expect(doc.css("p::text").get()).toBeNull();
    });

    test("nested whitespace", () => {
      const doc = pluck("<div>  <span>  </span>  </div>");
      expect(doc.css("span::text").get()).toBeNull();
    });

    test("text node between elements", () => {
      const doc = pluck("<div><span>A</span> <span>B</span></div>");
      const texts = doc.css("div span::text").getall();
      expect(texts).toEqual(["A", "B"]);
    });
  });

  describe("chaining complex selectors", () => {
    test("css then xpath", () => {
      const doc = pluck(complexTableHtml);
      const result = doc
        .css("#sales-data tbody")
        .xpath(".//tr[@data-region='east']//span[@class='region-name']::text")
        .get();
      expect(result).toBe("East");
    });

    test("xpath then css", () => {
      const doc = pluck(complexTableHtml);
      const result = doc.xpath("//article[@data-post-id='101']").css("h4 a::text").get();
      expect(result).toBe("Understanding XPath Axes");
    });

    test("multiple css chains", () => {
      const doc = pluck(complexTableHtml);
      const result = doc.css(".sidebar").css(".widget").css("article").css("h4 a::text").getall();
      expect(result).toEqual([
        "Understanding XPath Axes",
        "CSS Selectors Deep Dive",
        "HTML Parsing Techniques",
      ]);
    });

    test("or chain with multiple fallbacks", () => {
      const doc = pluck(complexTableHtml);
      const result = doc
        .css(".nonexistent::text")
        .or(doc.css(".also-missing::text"))
        .or(doc.css(".hero-title .brand::text"))
        .get();
      expect(result).toBe("Acme Corp");
    });

    test("first().css() chain", () => {
      const doc = pluck(complexTableHtml);
      const firstRowTotal = doc.css("#sales-data tbody tr").first().css(".total::text").get();
      expect(firstRowTotal).toBe("$68,700");
    });

    test("eq().xpath() chain", () => {
      const doc = pluck(complexTableHtml);
      const thirdRowRegion = doc
        .css("#sales-data tbody tr")
        .eq(2)
        .xpath(".//span[@class='region-name']::text")
        .get();
      expect(thirdRowRegion).toBe("East");
    });
  });

  describe("performance edge cases", () => {
    test("handles large number of matches", () => {
      const items = Array(1000).fill('<li class="item">Item</li>').join("");
      const doc = pluck(`<ul>${items}</ul>`);
      expect(doc.css("li").count).toBe(1000);
      expect(doc.css("li::text").getall().length).toBe(1000);
    });

    test("handles deeply nested structure", () => {
      let html = "<div>deepest</div>";
      for (let i = 0; i < 50; i++) {
        html = `<div class="level-${i}">${html}</div>`;
      }
      const doc = pluck(html);
      const deepest = doc.xpath("//div[not(div)]::text").get();
      expect(deepest).toBe("deepest");
    });

    test("handles wide structure", () => {
      const children = Array(100)
        .fill(0)
        .map((_, i) => `<div class="child" data-index="${i}">Child ${i}</div>`)
        .join("");
      const doc = pluck(`<div class="parent">${children}</div>`);
      expect(doc.css(".child").count).toBe(100);
      expect(doc.xpath("//div[@data-index='50']::text").get()).toBe("Child 50");
    });
  });

  describe("xpath text() vs ::text", () => {
    test("text() selects text nodes", () => {
      const doc = pluck("<p>Hello <b>World</b></p>");
      const textNodes = doc.xpath("//p/text()").getall();
      expect(textNodes).toContain("Hello");
    });

    test("::text extracts combined text", () => {
      const doc = pluck("<p>Hello <b>World</b></p>");
      const combined = doc.xpath("//p::text").get();
      expect(combined).toBe("Hello World");
    });
  });

  describe("attr extraction variations", () => {
    test("@attr direct xpath", () => {
      const doc = pluck(complexTableHtml);
      const version = doc.xpath("//div[@id='app']/@data-version").get();
      expect(version).toBe("2.5.1");
    });

    test("::attr() pseudo-element", () => {
      const doc = pluck(complexTableHtml);
      const version = doc.xpath("//div[@id='app']::attr(data-version)").get();
      expect(version).toBe("2.5.1");
    });

    test("css ::attr()", () => {
      const doc = pluck(complexTableHtml);
      const version = doc.css("#app::attr(data-version)").get();
      expect(version).toBe("2.5.1");
    });

    test("attr() method", () => {
      const doc = pluck(complexTableHtml);
      const version = doc.css("#app").attr("data-version");
      expect(version).toBe("2.5.1");
    });
  });

  describe("regex extraction", () => {
    test(".re() extracts all matches with no groups", () => {
      const doc = pluck("<p>Price: $99.99, Sale: $79.99</p>");
      const prices = doc
        .css("p::text")
        .re(/\$\d+\.\d+/)
        .getall();
      expect(prices).toEqual(["$99.99", "$79.99"]);
    });

    test(".re() extracts capturing groups", () => {
      const doc = pluck("<p>Price: $99.99, Sale: $79.99</p>");
      const prices = doc
        .css("p::text")
        .re(/\$(\d+\.\d+)/)
        .getall();
      expect(prices).toEqual(["99.99", "79.99"]);
    });

    test(".re() extracts multiple capturing groups", () => {
      const doc = pluck("<p>Date: 2024-01-15</p>");
      const parts = doc
        .css("p::text")
        .re(/(\d{4})-(\d{2})-(\d{2})/)
        .getall();
      expect(parts).toEqual(["2024", "01", "15"]);
    });

    test(".re() works with string pattern", () => {
      const doc = pluck("<p>Email: test@example.com</p>");
      const matches = doc.css("p::text").re("\\w+@\\w+\\.\\w+").getall();
      expect(matches).toEqual(["test@example.com"]);
    });

    test(".re().get() returns first match", () => {
      const doc = pluck("<p>Items: 5, 10, 15</p>");
      const first = doc.css("p::text").re(/\d+/).get();
      expect(first).toBe("5");
    });

    test(".re().get(default) returns default when no match", () => {
      const doc = pluck("<p>No numbers here</p>");
      const result = doc.css("p::text").re(/\d+/).get("none");
      expect(result).toBe("none");
    });

    test(".re_first() returns first match", () => {
      const doc = pluck("<p>Prices: $10, $20, $30</p>");
      const price = doc.css("p::text").re_first(/\$(\d+)/);
      expect(price).toBe("10");
    });

    test(".re_first() returns default when no match", () => {
      const doc = pluck("<p>No prices</p>");
      const price = doc.css("p::text").re_first(/\$(\d+)/, "N/A");
      expect(price).toBe("N/A");
    });

    test(".re_first() returns null when no match and no default", () => {
      const doc = pluck("<p>No prices</p>");
      const price = doc.css("p::text").re_first(/\$(\d+)/);
      expect(price).toBeNull();
    });

    test(".re() on multiple elements", () => {
      const doc = pluck("<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>");
      const numbers = doc.css("li::text").re(/\d+/).getall();
      expect(numbers).toEqual(["1", "2", "3"]);
    });

    test(".re().ok is true when matches exist", () => {
      const doc = pluck("<p>Has number: 42</p>");
      expect(doc.css("p::text").re(/\d+/).ok).toBe(true);
    });

    test(".re().ok is false when no matches", () => {
      const doc = pluck("<p>No numbers</p>");
      expect(doc.css("p::text").re(/\d+/).ok).toBe(false);
    });

    test(".re() works after xpath", () => {
      const doc = pluck("<div><p>Price: $50</p></div>");
      const price = doc
        .xpath("//p::text")
        .re(/\$(\d+)/)
        .get();
      expect(price).toBe("50");
    });

    test(".re() with global flag", () => {
      const doc = pluck("<p>a1b2c3</p>");
      const letters = doc.css("p::text").re(/[a-z]/g).getall();
      expect(letters).toEqual(["a", "b", "c"]);
    });

    test(".re() extracts from attribute values", () => {
      const doc = pluck('<a href="/product/123/details">Link</a>');
      const id = doc
        .css("a::attr(href)")
        .re(/\/product\/(\d+)/)
        .get();
      expect(id).toBe("123");
    });
  });

  describe("jmespath", () => {
    const jsonHtml = `
      <html>
        <script id="__NEXT_DATA__" type="application/json">
          {"props":{"pageProps":{"product":{"name":"Widget","price":29.99,"tags":["sale","new"]}}}}
        </script>
        <div data-config='{"theme":"dark","version":"2.0"}'>Content</div>
        <script type="application/ld+json">
          {"@type":"Product","name":"Gadget","offers":{"price":"49.99"}}
        </script>
      </html>
    `;

    test("extracts nested value from script JSON", () => {
      const doc = pluck(jsonHtml);
      const name = doc
        .css("script#__NEXT_DATA__::text")
        .jmespath("props.pageProps.product.name")
        .get();
      expect(name).toBe("Widget");
    });

    test("extracts value from data attribute JSON", () => {
      const doc = pluck(jsonHtml);
      const theme = doc.css("[data-config]::attr(data-config)").jmespath("theme").get();
      expect(theme).toBe("dark");
    });

    test("extracts array from JSON", () => {
      const doc = pluck(jsonHtml);
      const tags = doc
        .css("script#__NEXT_DATA__::text")
        .jmespath("props.pageProps.product.tags")
        .get();
      expect(tags).toEqual(["sale", "new"]);
    });

    test("extracts numeric value", () => {
      const doc = pluck(jsonHtml);
      const price = doc
        .css("script#__NEXT_DATA__::text")
        .jmespath("props.pageProps.product.price")
        .get();
      expect(price).toBe(29.99);
    });

    test("chained jmespath queries", () => {
      const doc = pluck(jsonHtml);
      const price = doc
        .css("script#__NEXT_DATA__::text")
        .jmespath("props.pageProps")
        .jmespath("product.price")
        .get();
      expect(price).toBe(29.99);
    });

    test("returns null for missing path", () => {
      const doc = pluck(jsonHtml);
      const missing = doc.css("script#__NEXT_DATA__::text").jmespath("props.missing.path").get();
      expect(missing).toBeNull();
    });

    test("returns default value when path missing", () => {
      const doc = pluck(jsonHtml);
      const value = doc.css("script#__NEXT_DATA__::text").jmespath("props.missing").get("default");
      expect(value).toBe("default");
    });

    test(".ok is true when jmespath finds value", () => {
      const doc = pluck(jsonHtml);
      const result = doc.css("script#__NEXT_DATA__::text").jmespath("props.pageProps.product.name");
      expect(result.ok).toBe(true);
    });

    test(".ok is false when jmespath finds nothing", () => {
      const doc = pluck(jsonHtml);
      const result = doc.css("script#__NEXT_DATA__::text").jmespath("nonexistent");
      expect(result.ok).toBe(false);
    });

    test("getall returns all matched values", () => {
      const doc = pluck(jsonHtml);
      const names = doc
        .css("script[type='application/json'], script[type='application/ld+json']::text")
        .jmespath("name")
        .getall();
      expect(names).toContain("Gadget");
    });

    test("handles invalid JSON gracefully", () => {
      const badHtml = `<script id="bad">not valid json</script>`;
      const doc = pluck(badHtml);
      const result = doc.css("script#bad::text").jmespath("anything");
      expect(result.ok).toBe(false);
      expect(result.get()).toBeNull();
    });

    test("jmespath array projection", () => {
      const doc = pluck(jsonHtml);
      const firstTag = doc
        .css("script#__NEXT_DATA__::text")
        .jmespath("props.pageProps.product.tags[0]")
        .get();
      expect(firstTag).toBe("sale");
    });
  });

  describe("custom logger", () => {
    test("uses custom logger for debug messages", () => {
      const logs: { level: string; message: string; context?: Record<string, unknown> }[] = [];
      const customLogger: Logger = {
        debug(message, context) {
          logs.push({ level: "debug", message, context });
        },
        info(message, context) {
          logs.push({ level: "info", message, context });
        },
        warn(message, context) {
          logs.push({ level: "warn", message, context });
        },
        error(message, context) {
          logs.push({ level: "error", message, context });
        },
      };

      const doc = pluck(html, { logger: customLogger });
      doc.css("h1::text").get();

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((l) => l.level === "debug")).toBe(true);
    });

    test("logs warning for invalid CSS selector", () => {
      const logs: { level: string; message: string; context?: Record<string, unknown> }[] = [];
      const customLogger: Logger = {
        debug(message, context) {
          logs.push({ level: "debug", message, context });
        },
        info(message, context) {
          logs.push({ level: "info", message, context });
        },
        warn(message, context) {
          logs.push({ level: "warn", message, context });
        },
        error(message, context) {
          logs.push({ level: "error", message, context });
        },
      };

      const doc = pluck(html, { logger: customLogger });
      doc.css("[[[invalid").get();

      expect(logs.some((l) => l.level === "warn" && l.message.includes("invalid CSS"))).toBe(true);
    });

    test("logger receives context with selector and matches", () => {
      const logs: { level: string; message: string; context?: Record<string, unknown> }[] = [];
      const customLogger: Logger = {
        debug(message, context) {
          logs.push({ level: "debug", message, context });
        },
        info(message, context) {
          logs.push({ level: "info", message, context });
        },
        warn(message, context) {
          logs.push({ level: "warn", message, context });
        },
        error(message, context) {
          logs.push({ level: "error", message, context });
        },
      };

      const doc = pluck(html, { logger: customLogger });
      doc.css("li").getall();

      const selectorLog = logs.find((l) => l.context?.selector === "li");
      expect(selectorLog).toBeDefined();
      expect(selectorLog?.context?.matches).toBe(2);
    });
  });

  describe("remove", () => {
    test("removes elements selected by css", () => {
      const testHtml = `<div><script>alert(1)</script><p>content</p></div>`;
      const doc = pluck(testHtml);
      doc.css("script").remove();
      expect(doc.outerHtml()).toBe("<div><p>content</p></div>");
    });

    test("removes elements selected by xpath", () => {
      const testHtml = `<div><nav>menu</nav><article>content</article></div>`;
      const doc = pluck(testHtml);
      doc.xpath("//nav").remove();
      expect(doc.outerHtml()).toBe("<div><article>content</article></div>");
    });

    test("removes multiple elements", () => {
      const testHtml = `<div><script>1</script><p>keep</p><script>2</script></div>`;
      const doc = pluck(testHtml);
      doc.css("script").remove();
      expect(doc.outerHtml()).toBe("<div><p>keep</p></div>");
    });

    test("strips unwanted elements before processing", () => {
      const testHtml = `
        <html>
          <body>
            <nav>navigation</nav>
            <article>main content</article>
            <script>tracking()</script>
            <aside>ads</aside>
          </body>
        </html>
      `;
      const doc = pluck(testHtml);
      const xpathsToStrip = ["//nav", "//script", "//aside"];
      for (const xpath of xpathsToStrip) {
        doc.xpath(xpath).remove();
      }
      const result = doc.css("body").html();
      expect(result).not.toContain("navigation");
      expect(result).not.toContain("tracking");
      expect(result).not.toContain("ads");
      expect(result).toContain("main content");
    });

    test("remove on empty selector does nothing", () => {
      const testHtml = `<div><p>content</p></div>`;
      const doc = pluck(testHtml);
      doc.css(".nonexistent").remove();
      expect(doc.outerHtml()).toBe("<div><p>content</p></div>");
    });
  });

  describe("outerHtml", () => {
    test("returns outerHtml from root document", () => {
      const testHtml = `<div>content</div>`;
      const doc = pluck(testHtml);
      expect(doc.outerHtml()).toBe("<div>content</div>");
    });

    test("returns outerHtml of selected element", () => {
      const testHtml = `<div><p class="test">content</p></div>`;
      const doc = pluck(testHtml);
      expect(doc.css("p.test").outerHtml()).toBe('<p class="test">content</p>');
    });

    test("returns null for empty selector", () => {
      const doc = pluck(`<div>test</div>`);
      expect(doc.css(".nonexistent").outerHtml()).toBe(null);
    });
  });

  describe("html on fragments", () => {
    test("returns all sibling elements from fragment", () => {
      const doc = pluck(`<p>First</p><div>Second</div><p>Third</p>`);
      expect(doc.html()).toBe("<p>First</p><div>Second</div><p>Third</p>");
    });

    test("returns fragment with whitespace preserved", () => {
      const doc = pluck(`<p>First</p>
<div>Second</div>
<p>Third</p>`);
      expect(doc.html()).toBe(`<p>First</p>
<div>Second</div>
<p>Third</p>`);
    });

    test("returns body innerHTML for full HTML document", () => {
      const doc = pluck(`<html><body><p>First</p><div>Second</div></body></html>`);
      expect(doc.html()).toBe("<p>First</p><div>Second</div>");
    });

    test("outerHtml returns all siblings from fragment", () => {
      const doc = pluck(`<p>First</p><div>Second</div>`);
      expect(doc.outerHtml()).toBe("<p>First</p><div>Second</div>");
    });
  });

  describe("attribute iteration", () => {
    test("iterating xpath @attr returns individual values via text()", () => {
      const testHtml = `<div><a href="/link1">A</a><a href="/link2">B</a></div>`;
      const doc = pluck(testHtml);
      const hrefs: string[] = [];
      for (const el of doc.xpath("//a/@href")) {
        hrefs.push(el.text());
      }
      expect(hrefs).toEqual(["/link1", "/link2"]);
    });

    test("iterating xpath @attr returns individual values via get()", () => {
      const testHtml = `<div><a href="/link1">A</a><a href="/link2">B</a></div>`;
      const doc = pluck(testHtml);
      const hrefs: string[] = [];
      for (const el of doc.xpath("//a/@href")) {
        hrefs.push(el.get()!);
      }
      expect(hrefs).toEqual(["/link1", "/link2"]);
    });

    test("iterating css ::attr() returns individual values", () => {
      const testHtml = `<div><a href="/link1">A</a><a href="/link2">B</a></div>`;
      const doc = pluck(testHtml);
      const hrefs: string[] = [];
      for (const el of doc.css("a::attr(href)")) {
        hrefs.push(el.text());
      }
      expect(hrefs).toEqual(["/link1", "/link2"]);
    });

    test("first() on attribute selector returns first value", () => {
      const testHtml = `<div><a href="/link1">A</a><a href="/link2">B</a></div>`;
      const doc = pluck(testHtml);
      expect(doc.xpath("//a/@href").first().text()).toBe("/link1");
    });

    test("last() on attribute selector returns last value", () => {
      const testHtml = `<div><a href="/link1">A</a><a href="/link2">B</a></div>`;
      const doc = pluck(testHtml);
      expect(doc.xpath("//a/@href").last().text()).toBe("/link2");
    });

    test("eq() on attribute selector returns nth value", () => {
      const testHtml = `<div><a href="/link1">A</a><a href="/link2">B</a><a href="/link3">C</a></div>`;
      const doc = pluck(testHtml);
      expect(doc.xpath("//a/@href").eq(1).text()).toBe("/link2");
    });

    test("toArray() on attribute selector returns array of selectors", () => {
      const testHtml = `<div><a href="/link1">A</a><a href="/link2">B</a></div>`;
      const doc = pluck(testHtml);
      const arr = doc.xpath("//a/@href").toArray();
      expect(arr.length).toBe(2);
      expect(arr[0].text()).toBe("/link1");
      expect(arr[1].text()).toBe("/link2");
    });

    test("each() on attribute selector iterates values", () => {
      const testHtml = `<div><a href="/link1">A</a><a href="/link2">B</a></div>`;
      const doc = pluck(testHtml);
      const hrefs: string[] = [];
      doc.xpath("//a/@href").each((el) => {
        hrefs.push(el.text());
      });
      expect(hrefs).toEqual(["/link1", "/link2"]);
    });
  });

  describe("remove mutation", () => {
    test("doc.html() reflects removed elements", () => {
      const testHtml = `<div><script>bad</script><p>good</p></div>`;
      const doc = pluck(testHtml);
      doc.xpath("//script").remove();
      expect(doc.html()).toBe("<div><p>good</p></div>");
    });

    test("doc.html() reflects multiple removals", () => {
      const testHtml = `<div><script>1</script><nav>menu</nav><p>content</p><script>2</script></div>`;
      const doc = pluck(testHtml);
      doc.xpath("//script").remove();
      doc.xpath("//nav").remove();
      expect(doc.html()).toBe("<div><p>content</p></div>");
    });

    test("chained selectors after remove see updated DOM", () => {
      const testHtml = `<div><script>bad</script><p>good</p></div>`;
      const doc = pluck(testHtml);
      doc.css("script").remove();
      expect(doc.css("script").ok).toBe(false);
      expect(doc.css("p").ok).toBe(true);
    });

    test("html() on root document returns full HTML after mutations", () => {
      const testHtml = `<html><body><script>x</script><main>content</main></body></html>`;
      const doc = pluck(testHtml);
      doc.xpath("//script").remove();
      const result = doc.html();
      expect(result).not.toContain("<script>");
      expect(result).toContain("<main>content</main>");
    });
  });
});
