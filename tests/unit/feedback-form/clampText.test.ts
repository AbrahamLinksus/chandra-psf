import { describe, expect, it } from "vitest";
import { clampText } from "@/features/feedback-form/TextField";

const hasLoneSurrogate = (s: string): boolean =>
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

describe("clampText: the 1,000 limit never splits a character (G-W3)", () => {
  it("leaves text within the limit untouched", () => {
    expect(clampText("வணக்கம் 😀", 1000)).toBe("வணக்கம் 😀");
  });

  it("drops an emoji that straddles the limit instead of keeping half of it", () => {
    const text = "a".repeat(999) + "😀"; // 1001 units; the emoji starts at unit 999
    const out = clampText(text, 1000);
    expect(out).toBe("a".repeat(999));
    expect(hasLoneSurrogate(out)).toBe(false);
  });

  it("keeps an emoji that fits exactly", () => {
    const out = clampText("a".repeat(998) + "😀" + "zzz", 1000);
    expect(out).toBe("a".repeat(998) + "😀");
    expect(out.length).toBe(1000);
  });

  it("never cuts a family (ZWJ) emoji in the middle", () => {
    const family = "👨‍👩‍👧‍👦";
    const out = clampText("a".repeat(989) + family.repeat(5), 1000);
    expect(out.length).toBeLessThanOrEqual(1000);
    expect(out).toBe("a".repeat(989) + family);
    expect(hasLoneSurrogate(out)).toBe(false);
  });

  it("never separates a Tamil letter from its vowel sign", () => {
    const syllable = "கொ"; // one grapheme, more than one code point
    const out = clampText("a".repeat(999) + syllable.repeat(3), 1000);
    expect(out).toBe("a".repeat(999));
    const tamil = clampText(syllable.repeat(800), 1000);
    expect(tamil.length).toBeLessThanOrEqual(1000);
    expect(tamil.length % syllable.length).toBe(0);
  });

  it("long mixed text ends under 1,000 with no lone surrogate", () => {
    const text = "<script>alert(1)</script> வணக்கம் 😀 ".repeat(80);
    const out = clampText(text, 1000);
    expect(out.length).toBeLessThanOrEqual(1000);
    expect(hasLoneSurrogate(out)).toBe(false);
    expect(text.startsWith(out)).toBe(true);
  });
});
