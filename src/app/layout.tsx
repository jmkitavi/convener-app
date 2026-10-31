import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/components/conveners-dashboard.css";
import "@/components/conveners-screens.css";
import "@/components/reports/reports.css";
import { Nav } from "@/components/nav";
import { getDataScope } from "@/lib/data-scope";
import { ReportProvider } from "@/components/reports/report-provider";
import { ReportToolbar } from "@/components/reports/report-toolbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Convener App — Golf League Manager",
  description:
    "Track foursomes match play performance and optimize pairings",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const scope = await getDataScope();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen antialiased">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <ReportProvider scope={scope}>
        <Nav scope={scope} />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
        >
          <ReportToolbar scope={scope} />
          {children}
        </main>
        </ReportProvider>
      </body>
    </html>
  );
}
