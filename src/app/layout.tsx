import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinHealth ✨ - Your Financial Health Companion",
  description: "FinHealth is your financial health companion. It helps you track your expenses, income, and investments. It also helps you plan for your retirement and save for your future.",
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
        </QueryProvider>
      </body>
    </html>
  );
}