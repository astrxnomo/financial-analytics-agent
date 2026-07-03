import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Financial Analytics Agent",
  description:
    "Enterprise financial analytics agent: revenue trends, budget performance, and anomaly detection, answered as charts.",
};

export const viewport: Viewport = {
  themeColor: "#12141c",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html className={cn("dark", sans.variable, mono.variable)} lang="en">
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
