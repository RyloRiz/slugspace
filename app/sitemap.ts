import type { MetadataRoute } from "next";
import { ROOMS, LOCATIONS } from "./lib/rooms";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://slugspace.vercel.app";

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/planner`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  const roomPages: MetadataRoute.Sitemap = ROOMS.map((room) => {
    const location = LOCATIONS.find((l) => l.id === room.locationId);
    const isStudyRoom =
      location?.groups.find((g) => g.id === room.groupId)?.name ===
      "Study Rooms";

    return {
      url: `${baseUrl}/room/${room.id}`,
      lastModified: new Date(),
      changeFrequency: "hourly" as const,
      priority: isStudyRoom ? 0.7 : 0.5,
    };
  });

  return [...staticPages, ...roomPages];
}
