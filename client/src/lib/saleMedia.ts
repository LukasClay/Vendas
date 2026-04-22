export type SaleAttachmentFile = {
  id: string;
  url: string;
  mime?: string | null;
  name?: string | null;
  isLegacy?: boolean;
};

export type SaleClientPhoto = {
  id: string;
  url: string;
  mime?: string | null;
  isLegacy?: boolean;
};

type SaleMediaLike = {
  attachmentUrl?: string | null;
  attachments?: SaleAttachmentFile[] | null;
  photo1Url?: string | null;
  photo2Url?: string | null;
  clientPhotos?: SaleClientPhoto[] | null;
};

export function getSaleAttachmentFiles(
  sale: SaleMediaLike
): SaleAttachmentFile[] {
  if (Array.isArray(sale.attachments)) return sale.attachments;

  if (!sale.attachmentUrl) return [];
  return [
    {
      id: "legacy-attachment",
      url: sale.attachmentUrl,
      name: "Comprovante principal",
      isLegacy: true,
    },
  ];
}

export function getSaleClientPhotos(sale: SaleMediaLike): SaleClientPhoto[] {
  if (Array.isArray(sale.clientPhotos)) return sale.clientPhotos;

  const photos = [
    sale.photo1Url
      ? { id: "legacy-photo-1", url: sale.photo1Url, isLegacy: true }
      : null,
    sale.photo2Url
      ? { id: "legacy-photo-2", url: sale.photo2Url, isLegacy: true }
      : null,
  ];

  return photos.filter(Boolean) as SaleClientPhoto[];
}

export function hasSaleClientPhotos(sale: SaleMediaLike): boolean {
  return getSaleClientPhotos(sale).length > 0;
}
