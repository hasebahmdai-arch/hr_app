"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useDeleteDepartment, useDepartments, useUpdateDepartment } from "@/hooks/use-admin";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetcher, buildQuery } from "@/lib/fetcher";
import { toastSuccess } from "@/lib/toast";
import type { PaginatedResponse } from "@/types/api";

interface PersonRow {
  _id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  email: string;
  designation?: string;
  role?: string;
}

export default function DepartmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? "");
  const { data: departments, isLoading, isError, refetch } = useDepartments();
  const dept = departments?.find((d) => d._id === id);
  const update = useUpdateDepartment(id);
  const remove = useDeleteDepartment();
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (dept) {
      setForm({
        name: dept.name,
        code: dept.code,
        description: dept.description ?? "",
      });
    }
  }, [dept]);

  const people = useQuery({
    queryKey: ["people", "department", id],
    queryFn: () =>
      fetcher<PaginatedResponse<PersonRow>>(
        `/api/people${buildQuery({ departmentId: id, limit: 100 })}`
      ),
    enabled: !!id,
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    try {
      await update.mutateAsync({
        name: form.name,
        code: form.code,
        description: form.description || undefined,
      });
      setSaved(true);
      toastSuccess("Department updated");
    } catch {
      /* mutationCache toasts the error */
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this department? This cannot be undone.")) return;
    try {
      await remove.mutateAsync(id);
      toastSuccess("Department deleted");
      router.push("/app/admin/departments");
    } catch {
      /* mutationCache toasts the error */
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={dept?.name ?? "Department"}
        subtitle="Details, edit, and employees"
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/admin/departments">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
        }
      />

      <QueryBoundary isLoading={isLoading} isError={isError || (!isLoading && !dept)} onRetry={() => refetch()}>
        {dept && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Edit department</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Code</Label>
                    <Input
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                  {saved && <p className="text-sm text-success">Saved</p>}
                  <div className="flex flex-wrap gap-2">
                    <LoadingButton type="submit" loading={update.isPending}>
                      Save changes
                    </LoadingButton>
                    <LoadingButton
                      type="button"
                      variant="destructive"
                      loading={remove.isPending}
                      onClick={handleDelete}
                    >
                      Delete
                    </LoadingButton>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Employees</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {people.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
                {people.data?.items.map((e) => (
                  <Link
                    key={e._id}
                    href={`/app/people/${e._id}`}
                    className="flex justify-between items-center py-2 border-b last:border-0 hover:bg-muted-bg/50 rounded px-1"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {e.firstName} {e.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {e.employeeCode}
                        {e.designation ? ` · ${e.designation}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{e.role}</span>
                  </Link>
                ))}
                {!people.isLoading && !people.data?.items.length && (
                  <p className="text-sm text-muted-foreground">No employees in this department</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
