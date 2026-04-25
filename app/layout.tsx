import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CCAPP — Cold Call Assistant",
  description:
    "Accessible cold calling web app with one-click Twilio calling and Gmail email integration.",
};

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import NavMenu from "./components/NavMenu";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  let user = null;
  if (token) {
    user = await verifyToken(token);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning className="bg-gray-900 min-h-screen">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:p-2 focus:bg-blue-600 focus:text-white focus:z-50">
          Skip to main content
        </a>

        <NavMenu user={user as any} />

        {/* Main content landmark */}
        <main id="main-content" role="main" tabIndex={-1}>
          {children}
        </main>

        {/* Live region for screen reader announcements */}
        <div
          id="live-announcements"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          role="status"
        />
      </body>
    </html>
  );
}
