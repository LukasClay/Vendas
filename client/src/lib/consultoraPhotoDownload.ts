export type ConsultoraPhotoId = string | number;

export function buildConsultoraPhotoDownloadUrl(
  saleId: number,
  photoId: ConsultoraPhotoId
): string {
  return `/api/consultora/photos/${saleId}/${encodeURIComponent(String(photoId))}/download`;
}
