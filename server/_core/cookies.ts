import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const secure = isSecureRequest(req);

  // No Railway, usamos o domínio padrão .up.railway.app.
  // SameSite: 'lax' é o mais seguro e compatível para navegação no mesmo site.
  // 'none' exige 'secure: true' e pode ser bloqueado por alguns navegadores em domínios de subnível.
  return {
    httpOnly: true,
    path: "/",
    secure,
    sameSite: "lax" as const,
  };
}
