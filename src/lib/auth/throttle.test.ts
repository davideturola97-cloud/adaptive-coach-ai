import { describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
const { clientIp, isBlocked, throttleKeys } = await import("./throttle");

describe("limite ai tentativi di accesso", () => {
  it("blocca dopo 5 errori sullo stesso account o 30 dallo stesso indirizzo", () => {
    expect(isBlocked("signIn", [4, 10])).toBe(false);
    expect(isBlocked("signIn", [5, 5])).toBe(true);
    expect(isBlocked("signIn", [0, 30])).toBe(true);
    expect(isBlocked("signUp", [0, 10])).toBe(true);
  });
  it("salva solo impronte, uguali per email scritte in modo diverso", () => {
    const [a, ip] = throttleKeys("signIn", "1.2.3.4", "Mario@Example.com ");
    const [b] = throttleKeys("signIn", "1.2.3.4", "mario@example.com");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(ip);
    expect(a).not.toContain("mario");
  });
  it("legge l'indirizzo del client", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });
});
