import { getRoomById, ROOMS } from "../../lib/rooms";
import RoomDetail from "./RoomDetail";

export function generateStaticParams() {
  return ROOMS.map((room) => ({ id: String(room.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const room = getRoomById(Number(id));
  return {
    title: room ? `${room.name} - UCSC Room Booker` : "Room Not Found",
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
  const room = getRoomById(Number(id));

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted text-lg">Room not found.</p>
      </div>
    );
  }

  return <RoomDetail room={room} initialDate={typeof date === "string" ? date : undefined} />;
}
