import "./globals.css";

export const metadata = { title: "KAMIFY", robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
