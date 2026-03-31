import { describe, test, expect } from "bun:test";
import { generateOpf, generateNcx } from "../convert";

describe("generateOpf", () => {
  test("includes the title in dc:title element", () => {
    const result = generateOpf("My Book", false);
    expect(result).toContain("<dc:title>My Book</dc:title>");
  });

  test("includes standard metadata elements", () => {
    const result = generateOpf("Test Title", false);
    expect(result).toContain("<dc:creator>URL Converter</dc:creator>");
    expect(result).toContain("<dc:language>en</dc:language>");
    expect(result).toContain('id="BookId"');
  });

  test("includes OPF package declaration", () => {
    const result = generateOpf("Test", false);
    expect(result).toContain('<?xml version="1.0"?>');
    expect(result).toContain("http://www.idpf.org/2007/opf");
    expect(result).toContain('version="2.0"');
  });

  test("includes manifest items for ncx, content, and styles", () => {
    const result = generateOpf("Test", false);
    expect(result).toContain('<item id="ncx" href="toc.ncx"');
    expect(result).toContain('<item id="content" href="content.html"');
    expect(result).toContain('<item id="styles" href="styles.css"');
  });

  test("includes spine referencing content", () => {
    const result = generateOpf("Test", false);
    expect(result).toContain('<spine toc="ncx">');
    expect(result).toContain('<itemref idref="content"/>');
  });

  test("does not include image item when hasImages is false", () => {
    const result = generateOpf("Test", false);
    expect(result).not.toContain("images/img0.jpg");
  });

  test("includes image item when hasImages is true", () => {
    const result = generateOpf("Test", true);
    expect(result).toContain(
      '<item id="img0" href="images/img0.jpg" media-type="image/jpeg"/>'
    );
  });

  test("handles empty title", () => {
    const result = generateOpf("", false);
    expect(result).toContain("<dc:title></dc:title>");
  });

  test("handles special characters in title", () => {
    const result = generateOpf('Title with <>&"\' chars', false);
    expect(result).toContain('<dc:title>Title with <>&"\' chars</dc:title>');
  });

  test("handles unicode characters in title", () => {
    const result = generateOpf("日本語タイトル 📚", false);
    expect(result).toContain("<dc:title>日本語タイトル 📚</dc:title>");
  });
});

describe("generateNcx", () => {
  test("includes the title in docTitle element", () => {
    const result = generateNcx("My Book");
    expect(result).toContain("<text>My Book</text>");
  });

  test("includes NCX namespace and version", () => {
    const result = generateNcx("Test");
    expect(result).toContain('<?xml version="1.0"?>');
    expect(result).toContain("http://www.daisy.org/z3986/2005/ncx/");
    expect(result).toContain('version="2005-1"');
  });

  test("includes head metadata elements", () => {
    const result = generateNcx("Test");
    expect(result).toContain('<meta name="dtb:depth" content="1"/>');
    expect(result).toContain('<meta name="dtb:totalPageCount" content="0"/>');
    expect(result).toContain('<meta name="dtb:maxPageNumber" content="0"/>');
    expect(result).toContain('<meta name="dtb:uid"');
  });

  test("includes navMap with a navPoint", () => {
    const result = generateNcx("Test");
    expect(result).toContain("<navMap>");
    expect(result).toContain('<navPoint id="navPoint-1" playOrder="1">');
    expect(result).toContain('<navLabel>');
    expect(result).toContain('<content src="content.html"/>');
  });

  test("includes title in both docTitle and navLabel", () => {
    const title = "Chapter Title";
    const result = generateNcx(title);
    const occurrences = result.match(/<text>Chapter Title<\/text>/g);
    expect(occurrences).toHaveLength(2);
  });

  test("handles empty title", () => {
    const result = generateNcx("");
    expect(result).toContain("<text></text>");
  });

  test("handles special characters in title", () => {
    const result = generateNcx('Title with <>&"\' chars');
    expect(result).toContain('<text>Title with <>&"\' chars</text>');
  });

  test("handles unicode characters in title", () => {
    const result = generateNcx("日本語タイトル 📚");
    expect(result).toContain("<text>日本語タイトル 📚</text>");
  });
});
