import { describe, expect, it } from "vitest";
import { getSaleStorageKeys } from "./saleMedia";

describe("getSaleStorageKeys", () => {
  it("coleta chaves conhecidas de comprovantes e fotos sem duplicar", () => {
    expect(
      getSaleStorageKeys({
        attachmentKey: "comprovantes/1/legacy.pdf",
        attachmentExtras: [
          {
            id: "proof-2",
            url: "https://cdn.test/proof-2.pdf",
            key: "comprovantes/1/proof-2.pdf",
            mime: "application/pdf",
          },
        ],
        photo1Key: "fotos/1/photo-1.jpg",
        photo2Key: "fotos/1/photo-1.jpg",
        photoExtras: [
          {
            id: "photo-extra",
            url: "https://cdn.test/photo-extra.jpg",
            key: "fotos/1/photo-extra.jpg",
            mime: "image/jpeg",
          },
        ],
      })
    ).toEqual([
      "comprovantes/1/legacy.pdf",
      "comprovantes/1/proof-2.pdf",
      "fotos/1/photo-1.jpg",
      "fotos/1/photo-extra.jpg",
    ]);
  });
});
