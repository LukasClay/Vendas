type StoredMediaRecord = {
  id: string;
  url: string;
  key: string;
  mime: string | null;
  name?: string | null;
};

type SaleMediaFields = {
  attachmentUrl?: string | null;
  attachmentKey?: string | null;
  attachmentMime?: string | null;
  attachmentExtras?: unknown;
  photo1Url?: string | null;
  photo1Key?: string | null;
  photo2Url?: string | null;
  photo2Key?: string | null;
  photoExtras?: unknown;
};

export type SalePublicAttachment = {
  id: string;
  url: string;
  mime: string | null;
  name: string | null;
  isLegacy: boolean;
};

export type SalePublicPhoto = {
  id: string;
  url: string;
  mime: string | null;
  isLegacy: boolean;
};

export const LEGACY_ATTACHMENT_ID = "legacy-attachment";
export const LEGACY_PHOTO_IDS = {
  1: "1",
  2: "2",
} as const;

function isStoredMediaRecord(value: unknown): value is StoredMediaRecord {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.url === "string" &&
    typeof candidate.key === "string" &&
    (candidate.mime === null || typeof candidate.mime === "string") &&
    (candidate.name === undefined ||
      candidate.name === null ||
      typeof candidate.name === "string")
  );
}

function normalizeStoredMedia(value: unknown): StoredMediaRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isStoredMediaRecord);
}

export function getStoredAttachmentExtras(
  sale: Pick<SaleMediaFields, "attachmentExtras">
): StoredMediaRecord[] {
  return normalizeStoredMedia(sale.attachmentExtras);
}

export function getStoredPhotoExtras(
  sale: Pick<SaleMediaFields, "photoExtras">
): StoredMediaRecord[] {
  return normalizeStoredMedia(sale.photoExtras);
}

export function getSaleStorageKeys(
  sale: Pick<
    SaleMediaFields,
    "attachmentKey" | "attachmentExtras" | "photo1Key" | "photo2Key" | "photoExtras"
  >
): string[] {
  const keys = new Set<string>();
  if (sale.attachmentKey) keys.add(sale.attachmentKey);
  for (const attachment of getStoredAttachmentExtras(sale)) {
    keys.add(attachment.key);
  }
  if (sale.photo1Key) keys.add(sale.photo1Key);
  if (sale.photo2Key) keys.add(sale.photo2Key);
  for (const photo of getStoredPhotoExtras(sale)) {
    keys.add(photo.key);
  }
  return Array.from(keys);
}

export function getSaleAttachmentFiles(
  sale: Pick<
    SaleMediaFields,
    "attachmentUrl" | "attachmentMime" | "attachmentExtras"
  >,
  options: { includeExtras?: boolean } = {}
): SalePublicAttachment[] {
  const attachments: SalePublicAttachment[] = [];

  if (sale.attachmentUrl) {
    attachments.push({
      id: LEGACY_ATTACHMENT_ID,
      url: sale.attachmentUrl,
      mime: sale.attachmentMime ?? null,
      name: "Comprovante principal",
      isLegacy: true,
    });
  }

  if (options.includeExtras === false) return attachments;

  for (const attachment of getStoredAttachmentExtras(sale)) {
    attachments.push({
      id: attachment.id,
      url: attachment.url,
      mime: attachment.mime ?? null,
      name: attachment.name ?? null,
      isLegacy: false,
    });
  }

  return attachments;
}

export function getSaleClientPhotos(
  sale: Pick<SaleMediaFields, "photo1Url" | "photo2Url" | "photoExtras">,
  options: { includeExtras?: boolean } = {}
): SalePublicPhoto[] {
  const photos: SalePublicPhoto[] = [];

  if (sale.photo1Url) {
    photos.push({
      id: LEGACY_PHOTO_IDS[1],
      url: sale.photo1Url,
      mime: null,
      isLegacy: true,
    });
  }

  if (sale.photo2Url) {
    photos.push({
      id: LEGACY_PHOTO_IDS[2],
      url: sale.photo2Url,
      mime: null,
      isLegacy: true,
    });
  }

  if (options.includeExtras === false) return photos;

  for (const photo of getStoredPhotoExtras(sale)) {
    photos.push({
      id: photo.id,
      url: photo.url,
      mime: photo.mime ?? null,
      isLegacy: false,
    });
  }

  return photos;
}

export function findSalePhotoForDownload(
  sale: Pick<
    SaleMediaFields,
    "photo1Url" | "photo1Key" | "photo2Url" | "photo2Key" | "photoExtras"
  >,
  photoId: string
): StoredMediaRecord | null {
  if (photoId === LEGACY_PHOTO_IDS[1] && sale.photo1Url && sale.photo1Key) {
    return {
      id: LEGACY_PHOTO_IDS[1],
      url: sale.photo1Url,
      key: sale.photo1Key,
      mime: null,
    };
  }

  if (photoId === LEGACY_PHOTO_IDS[2] && sale.photo2Url && sale.photo2Key) {
    return {
      id: LEGACY_PHOTO_IDS[2],
      url: sale.photo2Url,
      key: sale.photo2Key,
      mime: null,
    };
  }

  return getStoredPhotoExtras(sale).find(photo => photo.id === photoId) ?? null;
}

export function toPublicSale<
  T extends SaleMediaFields & Record<string, unknown>,
>(sale: T, options: { includeExtraMedia?: boolean } = {}) {
  const {
    attachmentKey: _attachmentKey,
    photo1Key: _photo1Key,
    photo2Key: _photo2Key,
    attachmentExtras: _attachmentExtras,
    photoExtras: _photoExtras,
    ...safeSale
  } = sale;
  const includeExtras = options.includeExtraMedia !== false;

  return {
    ...safeSale,
    attachmentUrl: sale.attachmentUrl ?? null,
    attachmentMime: sale.attachmentMime ?? null,
    photo1Url: sale.photo1Url ?? null,
    photo2Url: sale.photo2Url ?? null,
    attachments: getSaleAttachmentFiles(sale, { includeExtras }),
    clientPhotos: getSaleClientPhotos(sale, { includeExtras }),
  };
}
