import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RegisterServiceWorker } from "./register-service-worker";

const sans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fraunces is weight 400 only throughout this app — never bold — but its
// optical-size axis still needs to be requested so headings render crisp at
// display sizes rather than the body-text-tuned default.
const serif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "aayan",
  description: "Personal life-management app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "aayan",
  },
  icons: {
    icon: "/icons/icon-512.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#d9714b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${geistMono.variable} ${serif.variable}`}>
      <body>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
