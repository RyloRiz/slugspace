import { Metadata } from "next";
import StudyPlanner from "./StudyPlanner";
import { BreadcrumbJsonLd } from "../components/JsonLd";

export const metadata: Metadata = {
  title: "Study Planner — Plan Your Weekly UCSC Study Schedule",
  description:
    "Plan your weekly study schedule at UC Santa Cruz. Pick your days, times, and preferred library to get optimized room booking recommendations across McHenry and S&E Library.",
  alternates: {
    canonical: "/planner",
  },
  openGraph: {
    title: "Study Planner — Plan Your Weekly UCSC Study Schedule",
    description:
      "Plan your weekly study schedule at UC Santa Cruz. Get optimized room booking recommendations.",
    url: "/planner",
  },
};

export default function PlannerPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "SlugSpace", url: "https://slugspace.vercel.app" },
          { name: "Study Planner", url: "https://slugspace.vercel.app/planner" },
        ]}
      />
      <StudyPlanner />
    </>
  );
}
