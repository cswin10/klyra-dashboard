import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Klyra Dashboard",
  description: "Private AI Assistant Interface",
  icons: {
    icon: [
      { url: "/klyra-favicon.ico" },
      { url: "/klyra-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/klyra-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/klyra-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-page-bg min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
