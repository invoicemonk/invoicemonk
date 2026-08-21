import { describe, it, expect } from "vitest";
import { withTimeout } from "@/lib/startup";

describe("withTimeout", () => {
  it("resolves when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 100)).resolves.toBe("ok");
  });

  it("rejects with a startup timeout when the promise hangs", async () => {
    const hung = new Promise<string>(() => {});
    await expect(withTimeout(hung, 20)).rejects.toThrow("Application startup timed out");
  });

  it("propagates import failures so the recovery screen can render", async () => {
    await expect(withTimeout(Promise.reject(new Error("chunk failed")), 100)).rejects.toThrow(
      "chunk failed",
    );
  });
});
