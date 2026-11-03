"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  useShifts,
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
  type Shift,
} from "@/hooks/use-admin";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toastSuccess } from "@/lib/toast";

const emptyForm = {
  name: "",
  code: "",
  startTime: "09:00",
  endTime: "18:00",
  breakMinutes: "60",
  isActive: true,
};

export default function ShiftsAdminPage() {
  const { data, isLoading, isError, refetch } = useShifts();
  const create = useCreateShift();
  const update = useUpdateShift();
  const remove = useDeleteShift();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(s: Shift) {
    setEditingId(s._id);
    setForm({
      name: s.name,
      code: s.code,
      startTime: s.startTime,
      endTime: s.endTime,
      breakMinutes: String(s.breakMinutes ?? 60),
      isActive: s.isActive !== false,
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      code: form.code,
      startTime: form.startTime,
      endTime: form.endTime,
      breakMinutes: Number(form.breakMinutes),
      isActive: form.isActive,
    };
    try {
      if (editingId) {
        await update.mutateAsync({ id: editingId, ...payload });
        toastSuccess("Shift updated");
      } else {
        await create.mutateAsync(payload);
        toastSuccess("Shift created");
      }
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch {
      /* mutationCache toasts the error */
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this shift?")) return;
    try {
      await remove.mutateAsync(id);
      toastSuccess("Shift deleted");
    } catch {
      /* mutationCache toasts the error */
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Shifts</h1>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setEditingId(null);
              setForm(emptyForm);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Shift" : "New Shift"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start</Label>
                  <Input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>End</Label>
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Break (minutes)</Label>
                <Input
                  type="number"
                  value={form.breakMinutes}
                  onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })}
                />
              </div>
              {editingId && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  Active
                </label>
              )}
              <LoadingButton type="submit" className="w-full" loading={saving}>
                {editingId ? "Save" : "Create"}
              </LoadingButton>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.map((s) => (
            <Card key={s._id}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <CardTitle className="text-base">{s.name}</CardTitle>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(s)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <LoadingButton
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600"
                    loading={remove.isPending && remove.variables === s._id}
                    onClick={() => handleDelete(s._id)}
                  >
                    {!(remove.isPending && remove.variables === s._id) && (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </LoadingButton>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {s.startTime} – {s.endTime}
                </p>
                <p className="text-sm text-muted-foreground">Break: {s.breakMinutes ?? 60} min</p>
                {s.isActive === false && (
                  <p className="text-xs text-muted-foreground mt-1">Inactive</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </QueryBoundary>
    </div>
  );
}
