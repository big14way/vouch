import { describe, expect, it } from "vitest";
import { bytesToArtifact } from "./content";

const enc = (s: string) => new TextEncoder().encode(s);

describe("bytesToArtifact", () => {
  it("reviews SVG as markup text", async () => {
    const a = await bytesToArtifact("logo.svg", "image/svg+xml", enc('<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>'));
    expect(a.kind).toBe("text");
    if (a.kind === "text") expect(a.text).toContain("<circle");
  });

  it("keeps raster images as images", async () => {
    const a = await bytesToArtifact("shot.png", "image/png", new Uint8Array([137, 80, 78, 71]));
    expect(a.kind).toBe("image");
  });

  it("still refuses opaque binaries", async () => {
    const a = await bytesToArtifact("app.bin", "application/octet-stream", new Uint8Array([0, 1, 2]));
    expect(a.kind).toBe("error");
  });
});
