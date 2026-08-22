import { describe, expect, it, vi } from "vitest";
import {
  isPublicDemo,
  publicDemoAuthState,
  publicDemoMessage,
} from "@/server/demo/demo-mode";

vi.mock("server-only", () => ({}));

describe("public demo mode", () => {
  it("is explicit and defaults are resolved by the runtime env", () => {
    expect(isPublicDemo({ DEMO_MODE: true })).toBe(true);
    expect(isPublicDemo({ DEMO_MODE: false })).toBe(false);
  });

  it("returns one consistent explanation for blocked auth actions", () => {
    expect(publicDemoAuthState()).toEqual({
      message: publicDemoMessage,
      status: "error",
    });
  });
});
