import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.AUTH_URL || "http://localhost:3000"),
  applicationName: "FinHealth",
  title: {
    default: "FinHealth - Personal Finance Dashboard",
    template: "%s | FinHealth",
  },
  description:
    "Track accounts, transactions, budgets, investments, subscriptions, goals, and financial health in one private finance dashboard.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FinHealth",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

/**
 * Provides the application's root HTML layout and global providers.
 *
 * Wraps the page content with global font classes and a QueryProvider so all
 * descendants share the same query context.
 *
 * @param children - The page content to render inside the root layout.
 * @returns The root HTML element containing the application body and providers.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fredoka.variable} ${nunito.variable} antialiased`}
      >
        <QueryProvider>
          {children}
          <ServiceWorkerRegistrar />
        </QueryProvider>
      </body>
    </html>
  );
}
