import { Suspense } from "react";
import PeoplePageClient from "./PeoplePageClient";

export default function PeoplePage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-32 bg-muted-bg rounded-lg" />}>
      <PeoplePageClient />
    </Suspense>
  );
}
