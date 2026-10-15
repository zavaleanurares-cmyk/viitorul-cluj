import { describe, expect, it } from "vitest";
import { clipEmbedUrl, formatClock, parseClock, parseMatchVideoUrl } from "../src";

describe("adrese video", () => {
  it("recunoaște YouTube în toate formele", () => {
    expect(parseMatchVideoUrl("https://www.youtube.com/watch?v=abc123XYZ_-")?.id).toBe("abc123XYZ_-");
    expect(parseMatchVideoUrl("https://youtu.be/abc123")?.id).toBe("abc123");
    expect(parseMatchVideoUrl("https://m.youtube.com/shorts/xyz")?.id).toBe("xyz");
    expect(parseMatchVideoUrl("https://youtube.com/live/q1")?.source).toBe("youtube");
  });
  it("recunoaște Vimeo și VEO", () => {
    expect(parseMatchVideoUrl("https://vimeo.com/123456")).toMatchObject({ source: "vimeo", id: "123456" });
    expect(parseMatchVideoUrl("https://app.veo.co/matches/20261012-u17/")?.source).toBe("veo");
  });
  it("refuză adresele fără https", () => {
    expect(parseMatchVideoUrl("http://youtube.com/watch?v=a")).toBeNull();
    expect(parseMatchVideoUrl("javascript:alert(1)")).toBeNull();
  });
  it("redă intervalul pe YouTube fără cookie-uri", () => {
    expect(clipEmbedUrl("youtube", "https://youtu.be/abc", 65, 90)).toBe("https://www.youtube-nocookie.com/embed/abc?start=65&rel=0&modestbranding=1&end=90");
    expect(clipEmbedUrl("veo", "https://app.veo.co/x", 10, 20)).toBeNull();
  });
});

describe("timp", () => {
  it("formatează și citește", () => {
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(3930)).toBe("1:05:30");
    expect(parseClock("1:05")).toBe(65);
    expect(parseClock("1:05:30")).toBe(3930);
    expect(parseClock("90")).toBe(90);
    expect(parseClock("1:75")).toBeNull();
    expect(parseClock("abc")).toBeNull();
  });
});
