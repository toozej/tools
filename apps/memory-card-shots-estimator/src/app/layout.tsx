import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Memory Card Photo Estimator",
  description: "Estimate how many photos fit on a memory card by image resolution and file format.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
