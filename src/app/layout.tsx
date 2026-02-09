import type { Metadata } from "next";
import "./globals.css";

import { AppShell } from "@/ui/components/AppShell";

export const metadata: Metadata = {
  title: "Paint App",
  description: "Frontend baseline (Chat 0)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {/* Global AppShell ensures consistent layout across the entire app */}
        <AppShell appName="Paint App">{children}</AppShell>
      </body>
    </html>
  );
}
