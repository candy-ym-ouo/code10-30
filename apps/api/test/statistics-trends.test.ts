import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: { $queryRaw: mocks.queryRaw },
}));

import { getTrends } from "../src/services/statistics-service.js";

const shanghaiRange = {
  from: new Date("2025-12-30T16:00:00.000Z"),
  to: new Date("2026-03-01T15:59:59.000Z"),
  timezone: "Asia/Shanghai",
};

describe("getTrends 按用户时区分桶", () => {
  beforeEach(() => {
    mocks.queryRaw.mockReset();
  });

  it("原样返回数据库给出的桶日期，跨月跨年不漂移", async () => {
    mocks.queryRaw.mockResolvedValue([
      { bucket: "2025-12-31", practiceCount: 1n, durationMs: 1_800_000n, annotationCount: 2n },
      { bucket: "2026-01-01", practiceCount: 2n, durationMs: 3_600_000n, annotationCount: 0n },
      { bucket: "2026-03-01", practiceCount: 1n, durationMs: 600_000n, annotationCount: 1n },
    ]);

    const result = await getTrends("user-id", shanghaiRange);

    expect(result.data.map((row) => row.date)).toEqual(["2025-12-31", "2026-01-01", "2026-03-01"]);
    expect(result.data[1]).toMatchObject({ practiceCount: 2, durationMs: 3_600_000, annotationCount: 0 });
  });

  it("在 SQL 内按用户时区格式化桶日期，时区作为参数绑定", async () => {
    mocks.queryRaw.mockResolvedValue([]);

    await getTrends("user-id", shanghaiRange);

    const [query] = mocks.queryRaw.mock.calls[0];
    const sql: string = query.strings.join("?");
    expect(sql).toContain("to_char(");
    expect(sql).toContain("AT TIME ZONE");
    expect(sql).not.toContain("date_trunc");
    expect(query.values).toContain("Asia/Shanghai");
  });

  it("拒绝非法时区与倒置区间，且不落库", async () => {
    await expect(
      getTrends("user-id", { ...shanghaiRange, from: new Date("2026-02-01T00:00:00Z"), to: new Date("2026-01-01T00:00:00Z") }),
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    await expect(getTrends("user-id", { ...shanghaiRange, timezone: "Not/AZone" })).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });
});
