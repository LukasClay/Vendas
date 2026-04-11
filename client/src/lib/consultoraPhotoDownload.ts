export type ConsultoraPhotoSlot = 1 | 2;

export function buildConsultoraPhotoDownloadUrl(
  saleId: number,
  slot: ConsultoraPhotoSlot
): string {
  return `/api/consultora/photos/${saleId}/${slot}/download`;
}
