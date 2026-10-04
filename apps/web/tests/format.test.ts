import { describe, expect, it } from "vitest";
import { formatDuration, formatTimeMs, parseTimeInput, toLocalDateString } from "../src/utils/format.js";

describe("audio time formatting", () => {
  it("round-trips millisecond marker values", () => {
    expect(formatTimeMs(65_432)).toBe("01:05.432");
    expect(parseTimeInput("01:05.432")).toBe(65_432);
  });

  it("formats session duration for UI", () => {
    expect(formatDuration(90_000)).toBe("2 分钟");
    expect(formatDuration(3_660_000)).toBe("1 小时 1 分钟");
  });

  it("rejects invalid time input", () => {
    expect(parseTimeInput("01:60")).toBeNull();
  });

  it("formats the local calendar date, not the UTC date", () => {
    // 本地 1 月 1 日凌晨：UTC 日期仍停留在上一年 12 月 31 日（东半球时区）
    expect(toLocalDateString(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
    // 本地 10 月 4 日清晨：UTC 日期仍是 10 月 3 日
    expect(toLocalDateString(new Date(2026, 9, 4, 7, 0))).toBe("2026-10-04");
  });
});
