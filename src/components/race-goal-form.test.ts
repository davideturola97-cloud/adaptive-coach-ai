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
  it("cifra dopo cifra, come sul tastierino dell'iPhone", () => {
    let v = "";
    for (const c of "13900") v = formatTimeInput(v + c);
    expect(v).toBe("1:39:00");
    v = "";
    for (const c of "4530") v = formatTimeInput(v + c);
    expect(v).toBe("45:30");
    // Cancellare l'ultima cifra funziona
    expect(formatTimeInput("1:39:0")).toBe("13:90");
  });
});
