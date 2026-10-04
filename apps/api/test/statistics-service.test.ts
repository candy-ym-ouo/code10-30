import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
  Prisma: {
    empty: { strings: [], values: [] },
    sql(strings: TemplateStringsArray, ...values: unknown[]) {
      return { strings: [...strings], values };
    },
  },
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: { $queryRaw: mocks.queryRaw },
}));

const { getTrends } = await import("../src/services/statistics-service.js");

describe("getTrends timezone buckets", () => {
  beforeEach(() => {
    mocks.queryRaw.mockReset();
  });

  it("returns the user-local calendar date without converting the bucket through UTC", async () => {
    mocks.queryRaw.mockResolvedValueOnce([
      { bucket: "2026-01-31", practiceCount: 2n, durationMs: 45_000_000n, annotationCount: 3n },
      { bucket: "2026-02-01", practiceCount: 1n, durationMs: 20_000_000n, annotationCount: 1n },
      { bucket: "2026-12-31", practiceCount: 1n, durationMs: 10_000_000n, annotationCount: 0n },
      { bucket: "2027-01-01", practiceCount: 1n, durationMs: 15_000_000n, annotationCount: 2n },
    ]);

    const result = await getTrends("00000000-0000-0000-0000-000000000001", {
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2027-01-31T23:59:59Z"),
      timezone: "America/Los_Angeles",
    });

    expect(result.data).toEqual([
      { date: "2026-01-31", practiceCount: 2, durationMs: 45_000_000, annotationCount: 3 },
      { date: "2026-02-01", practiceCount: 1, durationMs: 20_000_000, annotationCount: 1 },
      { date: "2026-12-31", practiceCount: 1, durationMs: 10_000_000, annotationCount: 0 },
      { date: "2027-01-01", practiceCount: 1, durationMs: 15_000_000, annotationCount: 2 },
    ]);
  });

  it("groups by an immutable YYYY-MM-DD bucket in the requested timezone", async () => {
    mocks.queryRaw.mockResolvedValueOnce([]);

    await getTrends("00000000-0000-0000-0000-000000000002", {
      from: new Date("2026-12-31T08:00:00Z"),
      to: new Date("2027-01-01T08:00:00Z"),
      timezone: "Asia/Shanghai",
    });

    const query = mocks.queryRaw.mock.calls[0]?.[0] as { strings: string[]; values: unknown[] };
    const sql = query.strings.join("");

    expect(sql).toContain(`to_char(s."completed_at" AT TIME ZONE , 'YYYY-MM-DD') AS bucket`);
    expect(sql).toContain("GROUP BY bucket");
    expect(query.values[0]).toBe("Asia/Shanghai");
  });
});
