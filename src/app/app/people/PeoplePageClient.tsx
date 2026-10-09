"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus } from "lucide-react";
import { format } from "date-fns";
import { usePeople } from "@/hooks/use-people";
import { useCreateEmployee } from "@/hooks/use-employees";
import { useDepartments, useShifts } from "@/hooks/use-admin";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { Avatar } from "@/components/shared/Avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSession } from "next-auth/react";

function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  role: "employee" as "employee" | "hr",
  designation: "",
  departmentId: "",
  shiftId: "",
  hireDate: "",
  dateOfBirth: "",
};

export default function PeoplePageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(initialSearch);
  const [query, setQuery] = useState(initialSearch);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const { data: session } = useSession();
  const isHR = session?.user?.role === "hr";
  const { data, isLoading, isError, refetch } = usePeople(query, 1, includeInactive);
  const { data: departments } = useDepartments();
  const { data: shifts } = useShifts();
  const create = useCreateEmployee();
  const today = todayIso();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    try {
      const result = await create.mutateAsync({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        role: form.role,
        designation: form.designation || undefined,
        departmentId: form.departmentId || undefined,
        shiftId: form.shiftId || undefined,
        hireDate: form.hireDate,
        dateOfBirth: form.dateOfBirth,
      });
      setOpen(false);
      setForm(emptyForm);
      if (result.employee._id) {
        router.push(`/app/people/${result.employee._id}`);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create user");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl lg:text-2xl font-semibold">People Directory</h1>
        {isHR && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add User</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>New User</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>First Name</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
                  <div><Label>Last Name</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></div>
                </div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
                <div>
                  <Label>Role</Label>
                  <select className="w-full h-10 rounded-md border px-3 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "employee" | "hr" })}>
                    <option value="employee">Employee</option>
                    <option value="hr">HR</option>
                  </select>
                </div>
                <div><Label>Designation</Label><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
                <div>
                  <Label>Department</Label>
                  <select className="w-full h-10 rounded-md border px-3 text-sm" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                    <option value="">Select</option>
                    {departments?.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Shift</Label>
                  <select className="w-full h-10 rounded-md border px-3 text-sm" value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })}>
                    <option value="">Select</option>
                    {shifts?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input type="date" max={today} value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} required />
                </div>
                <div>
                  <Label>Date of Joining</Label>
                  <Input type="date" max={today} value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} required />
                </div>
                <p className="text-xs text-muted-foreground">
                  The employee will receive an email with a link to set their password. HR cannot set passwords.
                </p>
                {formError && <p className="text-sm text-red-600">{formError}</p>}
                <Button type="submit" className="w-full" disabled={create.isPending}>
                  {create.isPending ? "Creating..." : "Create User"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); setQuery(search); }}
        className="relative max-w-md"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code, email..."
          className="pl-9"
        />
      </form>

      {isHR && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
          Show inactive accounts
        </label>
      )}

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data?.items.map((person) => {
            const content = (
              <Card className={`hover:shadow-md transition-shadow ${person.accountActive === false ? "opacity-60" : ""}`}>
                <CardContent className="pt-6 flex items-center gap-4">
                  <Avatar firstName={person.firstName} lastName={person.lastName} fileId={person.avatarFileId} />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{person.firstName} {person.lastName}</p>
                    <p className="text-sm text-muted-foreground truncate">{person.designation || person.employeeCode}</p>
                    {person.department && <p className="text-xs text-primary truncate">{person.department.name}</p>}
                    {isHR && person.role === "hr" && <p className="text-xs text-muted-foreground">HR</p>}
                    {person.accountActive === false && <p className="text-xs text-red-600">Inactive</p>}
                  </div>
                </CardContent>
              </Card>
            );
            return isHR ? (
              <Link key={person._id} href={`/app/people/${person._id}`}>{content}</Link>
            ) : (
              <div key={person._id}>{content}</div>
            );
          })}
        </div>
        {!data?.items.length && <p className="text-center text-muted-foreground py-12">No people found</p>}
      </QueryBoundary>
    </div>
  );
}
