"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/shared/Avatar";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { ProfileDocumentsSection } from "@/components/shared/profile/ProfileDocumentsSection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteEmployee, useResendEmployeeInvite } from "@/hooks/use-employees";
import type { ProfileResponse } from "@/types/api";
import type { Employee } from "@/types/domain";

interface ProfileWebProps {
  profile: ProfileResponse;
  employeeId: string;
  isHREditor: boolean;
  canManageDocuments?: boolean;
  onSave: (body: Partial<Employee>) => Promise<unknown>;
  saving: boolean;
}

export function ProfileWeb({ profile, employeeId, isHREditor, canManageDocuments = false, onSave, saving }: ProfileWebProps) {
  const router = useRouter();
  const [form, setForm] = useState(profile.employee);
  const [inviteMessage, setInviteMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const resendInvite = useResendEmployeeInvite(employeeId);
  const deleteEmployee = useDeleteEmployee();
  const emp = profile.employee;
  const readOnly = !isHREditor;

  function updateField(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateNested(parent: string, field: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [parent]: { ...(prev[parent as keyof Employee] as Record<string, string>), [field]: value },
    }));
  }

  async function handleResendInvite() {
    setInviteMessage("");
    try {
      await resendInvite.mutateAsync();
      setInviteMessage("Invite email sent.");
    } catch (err) {
      setInviteMessage(err instanceof Error ? err.message : "Failed to send invite");
    }
  }

  async function handleDelete() {
    setDeleteError("");
    try {
      await deleteEmployee.mutateAsync(employeeId);
      setDeleteOpen(false);
      router.push("/app/people");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar firstName={emp.firstName} lastName={emp.lastName} fileId={form.avatarFileId} size="lg" />
        <div>
          <h1 className="text-2xl font-semibold">{emp.firstName} {emp.lastName}</h1>
          <p className="text-muted-foreground">{emp.designation || emp.employeeCode}</p>
          <p className="text-sm text-primary">{emp.profileCompletionPct}% complete</p>
          {isHREditor && <p className="text-sm text-muted-foreground">{emp.email}</p>}
        </div>
      </div>

      {isHREditor && (
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <Label>Role</Label>
              <select
                className="w-full h-10 rounded-md border px-3 text-sm"
                value={form.role}
                onChange={(e) => updateField("role", e.target.value)}
              >
                <option value="employee">Employee</option>
                <option value="hr">HR</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.accountActive}
                  onChange={(e) => updateField("accountActive", e.target.checked)}
                />
                Account active
              </label>
            </div>
            <div className="col-span-2 flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={handleResendInvite} disabled={resendInvite.isPending}>
                {resendInvite.isPending ? "Sending..." : "Resend invite email"}
              </Button>
              <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                Delete account
              </Button>
              {inviteMessage && <p className="text-sm text-muted-foreground">{inviteMessage}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><Label>First Name</Label><Input value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} disabled={readOnly} /></div>
              <div><Label>Last Name</Label><Input value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} disabled={readOnly} /></div>
              <div><Label>Phone</Label><Input value={form.personalInfo?.phone ?? ""} onChange={(e) => updateNested("personalInfo", "phone", e.target.value)} disabled={readOnly} /></div>
              <div><Label>Date of Birth</Label><Input type="date" value={form.personalInfo?.dateOfBirth?.slice(0, 10) ?? ""} onChange={(e) => updateNested("personalInfo", "dateOfBirth", e.target.value)} disabled={readOnly} /></div>
              {isHREditor && (
                <div className="col-span-2">
                  <Label>Avatar</Label>
                  <ImageUpload onUploaded={(id) => updateField("avatarFileId", id)} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact">
          <Card>
            <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <div><Label>Current Address</Label><Input value={form.contactInfo?.currentAddress ?? ""} onChange={(e) => updateNested("contactInfo", "currentAddress", e.target.value)} disabled={readOnly} /></div>
              <div><Label>Permanent Address</Label><Input value={form.contactInfo?.permanentAddress ?? ""} onChange={(e) => updateNested("contactInfo", "permanentAddress", e.target.value)} disabled={readOnly} /></div>
              <div><Label>Personal Phone</Label><Input value={form.contactInfo?.personalPhone ?? ""} onChange={(e) => updateNested("contactInfo", "personalPhone", e.target.value)} disabled={readOnly} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment">
          <Card>
            <CardHeader><CardTitle>Employment</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><Label>Designation</Label><Input value={form.designation ?? ""} onChange={(e) => updateField("designation", e.target.value)} disabled={readOnly} /></div>
              <div>
                <Label>Department</Label>
                <select className="w-full h-10 rounded-md border px-3 text-sm" value={form.departmentId ?? ""} onChange={(e) => updateField("departmentId", e.target.value)} disabled={readOnly}>
                  <option value="">Select</option>
                  {profile.departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Shift</Label>
                <select className="w-full h-10 rounded-md border px-3 text-sm" value={form.shiftId ?? ""} onChange={(e) => updateField("shiftId", e.target.value)} disabled={readOnly}>
                  <option value="">Select</option>
                  {profile.shifts.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.startTime}-{s.endTime})</option>)}
                </select>
              </div>
              {isHREditor && (
                <div><Label>Hire Date</Label><Input type="date" value={form.hireDate?.slice(0, 10) ?? ""} onChange={(e) => updateField("hireDate", e.target.value)} /></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
            <CardContent>
              <ProfileDocumentsSection
                employeeId={employeeId}
                documents={(profile.documents as { _id: string; fileId?: string; title?: string }[]) ?? []}
                canUpload={canManageDocuments}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isHREditor && (
        <Button onClick={() => onSave(form)} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account permanently?</DialogTitle>
            <DialogDescription>
              This will permanently delete {emp.firstName} {emp.lastName} ({emp.email}) and related timesheets, requests, documents, and files. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteEmployee.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteEmployee.isPending}>
              {deleteEmployee.isPending ? "Deleting..." : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
