export type ConsultoraPhotoId = string;

export function buildConsultoraPhotoDownloadUrl(
  saleId: number,
  photoId: ConsultoraPhotoId
): string {
  return `/api/consultora/photos/${saleId}/${encodeURIComponent(photoId)}/download`;
}
