import { describe, expect, it } from "vitest";
import { formatTimeInput } from "./time-input";

describe("tempo scritto solo con cifre (iPhone)", () => {
  it("mette i due punti da solo", () => {
    expect(formatTimeInput("4530")).toBe("45:30");
    expect(formatTimeInput("13900")).toBe("1:39:00");
    expect(formatTimeInput("013900")).toBe("1:39:00");
    expect(formatTimeInput("21500")).toBe("2:15:00");
    expect(formatTimeInput("45")).toBe("45");
    expect(formatTimeInput("1:39:00")).toBe("1:39:00");
  });
});
