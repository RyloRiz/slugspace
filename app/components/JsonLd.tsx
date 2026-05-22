export function WebsiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "SlugSpace",
    url: "https://slugspace.vercel.app",
    description:
      "Unofficial tool to find and book study rooms at UC Santa Cruz libraries. Real-time availability for 89+ rooms across McHenry and Science & Engineering Library.",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Person",
      name: "SlugSpace",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function LibraryJsonLd({
  name,
  shortName,
  roomCount,
}: {
  name: string;
  shortName: string;
  roomCount: number;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Library",
    name,
    alternateName: shortName,
    amenityFeature: {
      "@type": "LocationFeatureSpecification",
      name: "Study Rooms",
      value: roomCount,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function RoomJsonLd({
  roomName,
  libraryName,
  capacity,
  floor,
  features,
  roomId,
}: {
  roomName: string;
  libraryName: string;
  capacity: number;
  floor: string;
  features: string[];
  roomId: number;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "MeetingRoom",
    name: roomName,
    url: `https://slugspace.vercel.app/room/${roomId}`,
    containedInPlace: {
      "@type": "Library",
      name: libraryName,
    },
    maximumAttendeeCapacity: capacity,
    floor,
    amenityFeature: features.map((f) => ({
      "@type": "LocationFeatureSpecification",
      name: f,
      value: true,
    })),
    isAccessibleForFree: true,
    publicAccess: true,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function FAQJsonLd() {
  const faqs = [
    {
      question: "How do I book a study room at UCSC?",
      answer:
        "Use SlugSpace, an unofficial student-built tool, to check real-time availability across McHenry Library and Science & Engineering Library. Select a room, pick an available time slot, and you'll be directed to the UCSC booking system to confirm.",
    },
    {
      question: "How many study rooms are available at UCSC?",
      answer:
        "UCSC has 89 bookable spaces across two libraries: McHenry Library (study rooms, Digital Scholarship Commons, and a Keyboard Room) and Science & Engineering Library (study rooms and Innovation Studio with 3D printers, laser cutters, and Cricut machines).",
    },
    {
      question: "What is the maximum booking duration for UCSC study rooms?",
      answer:
        "You can book UCSC study rooms for up to 4 hours per day. All bookings must be in consecutive 30-minute time slots.",
    },
    {
      question: "Can I use the Innovation Studio at UCSC?",
      answer:
        "Yes! The Innovation Studio in the Science & Engineering Library offers 3D printers (Bambu), laser cutters (Glowforge), and vinyl cutters (Cricut). Use SlugSpace to check availability and book equipment.",
    },
  ];

  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
