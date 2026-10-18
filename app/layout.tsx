import type { Metadata } from "next";
import { Inter, Prompt } from "next/font/google";
import "./globals.css";

// ตาม mockup ใน ui/: Inter สำหรับตัวเลข/อังกฤษ, Prompt สำหรับภาษาไทย
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const prompt = Prompt({ variable: "--font-prompt", subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "ระบบจัดการหอพัก",
  description: "ระบบจัดการหอพักผ่าน LINE",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${inter.variable} ${prompt.variable} h-full antialiased`}
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
