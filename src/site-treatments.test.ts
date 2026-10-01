import { expect, test } from "bun:test";

const PAGES = [
  "index.html",
  "dashboard/index.html",
  "docs/index.html",
  "privacy/index.html",
  "terms/index.html",
  "developers/index.html",
] as const;

test("built surfaces render aceternity and magic ui", async () => {
  for (const page of PAGES) {
    const html = await Bun.file(new URL(`../web/out/${page}`, import.meta.url)).text();
    expect(html).toContain("animate-spotlight");
    expect(html).toContain("animate-aurora-wash");
    expect(html).toContain('data-aceternity="background-beams"');
    expect(html).toContain("--border-beam-width");
  }
});

test("legal pages do not ship a webgl or webgpu canvas", async () => {
  for (const page of ["privacy/index.html", "terms/index.html"]) {
    const html = await Bun.file(new URL(`../web/out/${page}`, import.meta.url)).text();
    expect(html).not.toContain("<canvas");
    expect(html.toLowerCase()).not.toContain("webgl");
    expect(html.toLowerCase()).not.toContain("webgpu");
  }
});
