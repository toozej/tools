import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Photos Viewer",
  description: "Browse public photos from Lomography, Reddit, Flickr, and Imgur",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
