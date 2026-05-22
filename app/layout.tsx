import type { Metadata } from "next";
import { Young_Serif, Figtree } from "next/font/google";
import { PageTransition } from "./components/ui/page-transition";
import StudyTimer from "./components/StudyTimer";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SlugSpace",
    startupImage: "/icon-512x512.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
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
      <head>
        <meta name="theme-color" content="#003c6c" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <PageTransition>{children}</PageTransition>
        <StudyTimer />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
