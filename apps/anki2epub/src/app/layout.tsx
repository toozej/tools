import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "anki2epub - Convert Anki Decks to EPUB for E-Ink Readers",
  description: "Convert Anki flashcard decks to EPUB files optimized for e-ink readers like Kindle, Kobo, Onyx Boox, and Xteink",
  keywords: ["anki", "epub", "flashcards", "e-ink", "kindle", "kobo", "onyx boox", "xteink", "study", "converter"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
