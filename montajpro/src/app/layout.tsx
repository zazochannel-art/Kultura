import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { AppProvider } from "@/lib/app-provider";
import { ServiceWorker } from "@/components/pwa/service-worker";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MontajPro — scări, parchet, plinte",
    template: "%s · MontajPro",
  },
  description:
    "Aplicația de lucru pentru montatori: clienți, lucrări, măsurători, oferte, bani și fotografii, într-un singur loc.",
  manifest: "/manifest.webmanifest",
  applicationName: "MontajPro",
  appleWebApp: {
    capable: true,
    title: "MontajPro",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: true },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#09090B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full antialiased">
        <AppProvider>{children}</AppProvider>
        <Toaster
          position="top-center"
          richColors
          theme="dark"
          toastOptions={{
            style: {
              background: "#18181B",
              border: "1px solid #27272A",
              color: "#FAFAFA",
            },
          }}
        />
        <ServiceWorker />
      </body>
    </html>
  );
}
