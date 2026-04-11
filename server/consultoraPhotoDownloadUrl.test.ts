import { describe, expect, it } from "vitest";
import { buildConsultoraPhotoDownloadUrl } from "../client/src/lib/consultoraPhotoDownload";

describe("buildConsultoraPhotoDownloadUrl", () => {
  it("gera rota same-origin para o download da foto", () => {
    expect(buildConsultoraPhotoDownloadUrl(123, 2)).toBe(
      "/api/consultora/photos/123/2/download"
    );
  });
});
