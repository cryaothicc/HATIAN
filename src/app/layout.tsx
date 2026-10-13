import type { Metadata } from "next";
import { Sora, Manrope } from "next/font/google";
import "@/index.css";
import "@/base.css";
import "@/style-pack.css";
import "@/tints.css";
import "@/motion.css";
import { PaletteInstaller } from "@/components/palette-installer";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hatian",
  description: "Hatian — live, backend-free expense splitter.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sora.variable} ${manrope.variable}`}>
      <body>
        <PaletteInstaller />
        <div className="flex min-h-screen">
          <div className="min-h-screen min-w-0 flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
