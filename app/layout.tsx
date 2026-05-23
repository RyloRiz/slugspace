import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  themeColor: "#003c6c",
  viewportFit: "cover",
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://slugspace.vercel.app"),
  title: {
    default: "SlugSpace — UCSC Study Room Booking",
    template: "%s | SlugSpace",
  },
  description:
    "Find and book study rooms at UC Santa Cruz libraries. Check real-time availability for McHenry Library and Science & Engineering Library — 89 rooms, instant scheduling.",
  keywords: [
    "UCSC",
    "UC Santa Cruz",
    "study rooms",
    "library booking",
    "McHenry Library",
    "Science Engineering Library",
    "SlugSpace",
    "room reservation",
    "study space",
    "college study rooms",
    "university library",
    "Santa Cruz",
    "group study",
    "Innovation Studio",
    "3D printing UCSC",
  ],
  authors: [{ name: "SlugSpace" }],
  creator: "SlugSpace",
  publisher: "SlugSpace",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "SlugSpace",
    title: "SlugSpace — UCSC Study Room Booking",
    description:
      "Find and book study rooms at UC Santa Cruz libraries. Real-time availability for 89 rooms across McHenry and S&E Library.",
    images: [
      {
        url: "/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "SlugSpace — UCSC Study Room Booking",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "SlugSpace — UCSC Study Room Booking",
    description:
      "Find and book study rooms at UC Santa Cruz libraries. Real-time availability for 89 rooms.",
    images: ["/icon-512x512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
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
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
		<script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="70623c12-b5e4-4f24-bfee-bf477dd6b553"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <PageTransition>{children}</PageTransition>
        <StudyTimer />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
