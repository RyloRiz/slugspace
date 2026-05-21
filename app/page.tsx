import { Suspense } from "react";
import BookingDashboard from "./components/BookingDashboard";

export default function Home() {
  return (
    <Suspense>
      <BookingDashboard />
    </Suspense>
  );
}
