import { Metadata } from "next";
import StudyPlanner from "./StudyPlanner";

export const metadata: Metadata = {
  title: "Study Planner - UCSC Room Booker",
  description: "Plan your weekly study schedule with optimal room bookings",
};

export default function PlannerPage() {
  return <StudyPlanner />;
}
