export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// Tipos de venda que permitem anexar fotos do cliente
export const TYPES_WITH_PHOTOS = ["individual"] as const;
export type TypeWithPhotos = typeof TYPES_WITH_PHOTOS[number];
