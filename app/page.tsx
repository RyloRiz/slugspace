import { Suspense } from "react";
import { Metadata } from "next";
import BookingDashboard from "./components/BookingDashboard";
import { WebsiteJsonLd, FAQJsonLd, BreadcrumbJsonLd } from "./components/JsonLd";

export const metadata: Metadata = {
  title: "SlugSpace — Book UCSC Study Rooms | Real-Time Availability",
  description:
    "Book study rooms at UC Santa Cruz in seconds. See real-time availability for 89 rooms across McHenry Library and Science & Engineering Library. Free for all UCSC students.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SlugSpace — Book UCSC Study Rooms | Real-Time Availability",
    description:
      "Book study rooms at UC Santa Cruz in seconds. Real-time availability for 89 rooms across McHenry and S&E Library.",
    url: "/",
  },
};

export default function Home() {
  return (
    <>
      <WebsiteJsonLd />
      <FAQJsonLd />
      <BreadcrumbJsonLd
        items={[{ name: "SlugSpace", url: "https://slugspace.vercel.app" }]}
      />
      <Suspense>
        <BookingDashboard />
      </Suspense>
    </>
  );
}
