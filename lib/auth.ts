import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE = "painel_sessao";

export function tokenSessao() {
  const senha = process.env.PAINEL_SENHA || "";
  const segredo = process.env.SESSION_SECRET || senha;
  return createHmac("sha256", segredo).update("painel-v1:" + senha).digest("hex");
}

export function iguais(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function estaLogado() {
  if (!process.env.PAINEL_SENHA) return false;
  const c = (await cookies()).get(COOKIE)?.value || "";
  return iguais(c, tokenSessao());
}
