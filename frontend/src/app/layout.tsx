import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioLens | Biomedical Knowledge Explorer",
  description:
    "AI-powered interactive visualization platform for exploring genes, diseases, drugs, and clinical trials.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
