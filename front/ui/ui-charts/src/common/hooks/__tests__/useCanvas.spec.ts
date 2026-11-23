import { cleanup, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beaforeEach, afterEach } from "vitest";

import { useCanvas } from "../useCanvas";

describe("useCanvas", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // check render canvas
  it("blablabla", () => {
    // ...
  });

  // check hidden picking canvas per layer

  // check register

  // check unregister

  // check redraws

  // check resize

  // check pixel ratio updates

  // check picking metadata
});
