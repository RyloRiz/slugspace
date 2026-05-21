import type { Metadata } from "next";
import { Young_Serif, Figtree } from "next/font/google";
import { PageTransition } from "./components/ui/page-transition";
import "./globals.css";

const youngSerif = Young_Serif({
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
});

const figtree = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SlugSpace",
  description: "Find and book study rooms at UC Santa Cruz libraries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${youngSerif.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
