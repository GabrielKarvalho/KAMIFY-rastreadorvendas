import "./globals.css";
import type { Metadata, Viewport } from "next";
import RegistrarSW from "@/components/RegistrarSW";

export const metadata: Metadata = {
  title: "KAMIFY",
  robots: { index: false, follow: false },
  applicationName: "KAMIFY",
  appleWebApp: { capable: true, title: "KAMIFY", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32" }, { url: "/icons/icon-192.png", sizes: "192x192" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#2f6bff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
