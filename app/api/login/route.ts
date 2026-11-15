import { NextRequest, NextResponse } from "next/server";
import { COOKIE, iguais, tokenSessao } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const senha = String(form.get("senha") || "");
  const certa = process.env.PAINEL_SENHA || "";

  if (!certa || !iguais(senha, certa)) {
    await new Promise((r) => setTimeout(r, 800)); // freia tentativa e erro
    return NextResponse.redirect(new URL("/entrar?erro=1", req.url), 303);
  }

  const res = NextResponse.redirect(new URL("/painel", req.url), 303);
  res.cookies.set(COOKIE, tokenSessao(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
