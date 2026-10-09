"use client";

import { ProfileContent } from "@/components/shared/profile/ProfileContent";

export default function PeopleDetailPage({ params }: { params: { id: string } }) {
  return <ProfileContent employeeId={params.id} isHREditor />;
}
