"use client";

import { ResponsiveView } from "@/components/shared/ResponsiveView";
import { ProfileWeb } from "@/components/web/profile/ProfileWeb";
import { ProfileMobile } from "@/components/mobile/profile/ProfileMobile";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { useSession } from "next-auth/react";

export function ProfileContent({ employeeId, isHREditor = false }: { employeeId?: string; isHREditor?: boolean }) {
  const { data: session } = useSession();
  const resolvedId = employeeId ?? session?.user?.id;
  const { data, isLoading, isError, refetch } = useProfile(employeeId);
  const update = useUpdateProfile(employeeId);

  return (
    <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
      {data && resolvedId && (
        <ResponsiveView
          web={
            <ProfileWeb
              profile={data}
              employeeId={resolvedId}
              isHREditor={isHREditor}
              canManageDocuments={isHREditor}
              onSave={(body) => update.mutateAsync(body)}
              saving={update.isPending}
            />
          }
          mobile={
            <ProfileMobile
              profile={data}
              employeeId={resolvedId}
              isHREditor={isHREditor}
              canManageDocuments={isHREditor}
              onSave={(body) => update.mutateAsync(body)}
              saving={update.isPending}
            />
          }
        />
      )}
    </QueryBoundary>
  );
}
