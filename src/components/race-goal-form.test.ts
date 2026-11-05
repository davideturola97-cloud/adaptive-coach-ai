import { describe, expect, it } from "vitest";
import { fromParts, toParts } from "./time-input";

describe("tempo con ore, minuti e secondi", () => {
  it("dai quadratini al testo e ritorno", () => {
    expect(fromParts({ h: 1, m: 39, s: 0 }, true)).toBe("1:39:00");
    expect(fromParts({ h: 0, m: 45, s: 30 }, true)).toBe("45:30");
    expect(fromParts({ h: 0, m: 24, s: 5 }, false)).toBe("24:05");
    expect(fromParts({ h: 0, m: 0, s: 0 }, true)).toBe("");
    expect(toParts("1:39:00")).toEqual({ h: 1, m: 39, s: 0 });
    expect(toParts("45:30")).toEqual({ h: 0, m: 45, s: 30 });
    expect(toParts(undefined)).toEqual({ h: 0, m: 0, s: 0 });
  });
});
