import { Metadata } from "next";
import { getRoomById, ROOMS, LOCATIONS } from "../../lib/rooms";
import { RoomJsonLd, BreadcrumbJsonLd } from "../../components/JsonLd";
import RoomDetail from "./RoomDetail";

export function generateStaticParams() {
  return ROOMS.map((room) => ({ id: String(room.id) }));
}

function getRoomContext(roomId: number) {
  const room = getRoomById(roomId);
  if (!room) return null;
  const location = LOCATIONS.find((l) => l.id === room.locationId);
  const group = location?.groups.find((g) => g.id === room.groupId);
  return { room, location, group };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ctx = getRoomContext(Number(id));
  if (!ctx) return { title: "Room Not Found" };

  const { room, location } = ctx;
  const libraryName = location?.shortName ?? "UCSC Library";
  const featuresText =
    room.features.length > 0 ? ` Features: ${room.features.join(", ")}.` : "";
  const description = `Book ${room.name} at ${libraryName} — seats ${room.capacity}, ${room.floor} floor.${featuresText} Check real-time availability and reserve your spot.`;

  return {
    title: `${room.name} — ${libraryName}`,
    description,
    alternates: {
      canonical: `/room/${room.id}`,
    },
    openGraph: {
      title: `${room.name} — ${libraryName} | SlugSpace`,
      description,
      url: `/room/${room.id}`,
    },
  };
}

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const { date } = await searchParams;
  const ctx = getRoomContext(Number(id));

  if (!ctx) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted text-lg">Room not found.</p>
      </div>
    );
  }

  const { room, location, group } = ctx;
  const libraryName = location?.name ?? "UCSC Library";
  const baseUrl = "https://slugspace.vercel.app";

  return (
    <>
      <RoomJsonLd
        roomName={room.name}
        libraryName={libraryName}
        capacity={room.capacity}
        floor={room.floor}
        features={room.features}
        roomId={room.id}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "SlugSpace", url: baseUrl },
          { name: libraryName, url: baseUrl },
          ...(group ? [{ name: group.name, url: baseUrl }] : []),
          { name: room.name, url: `${baseUrl}/room/${room.id}` },
        ]}
      />
      <RoomDetail
        room={room}
        initialDate={typeof date === "string" ? date : undefined}
      />
    </>
  );
}
