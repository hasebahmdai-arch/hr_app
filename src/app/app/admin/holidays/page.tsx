"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  useCreateHoliday,
  useDeleteHoliday,
  useHolidaysAdmin,
  useUpdateHoliday,
  type Holiday,
} from "@/hooks/use-admin";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toastSuccess } from "@/lib/toast";

const emptyForm = { date: "", name: "", isActive: true };

export default function HolidaysAdminPage() {
  const { data, isLoading, isError, refetch } = useHolidaysAdmin();
  const create = useCreateHoliday();
  const update = useUpdateHoliday();
  const remove = useDeleteHoliday();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setOpen(true);
  }

  function openEdit(h: Holiday) {
    setEditingId(h._id);
    setForm({
      date: h.date.slice(0, 10),
      name: h.name,
      isActive: h.isActive !== false,
    });
    setError("");
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (editingId) {
        await update.mutateAsync({
          id: editingId,
          date: form.date,
          name: form.name,
          isActive: form.isActive,
        });
        toastSuccess("Holiday updated");
      } else {
        await create.mutateAsync({ date: form.date, name: form.name, isActive: true });
        toastSuccess("Holiday created");
      }
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save holiday");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this holiday?")) return;
    try {
      await remove.mutateAsync(id);
      toastSuccess("Holiday deleted");
    } catch {
      /* mutationCache toasts the error */
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Holidays</h1>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setEditingId(null);
              setForm(emptyForm);
              setError("");
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
              <DialogTitle>{editingId ? "Edit Holiday" : "New Holiday"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
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
              {error && <p className="text-sm text-red-600">{error}</p>}
              <LoadingButton type="submit" className="w-full" loading={saving}>
                {editingId ? "Save" : "Create"}
              </LoadingButton>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.map((h) => (
            <Card key={h._id}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <CardTitle className="text-base">{h.name}</CardTitle>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(h)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <LoadingButton
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600"
                    loading={remove.isPending && remove.variables === h._id}
                    onClick={() => handleDelete(h._id)}
                  >
                    {!(remove.isPending && remove.variables === h._id) && (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </LoadingButton>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{h.date}</p>
                {h.isActive === false && (
                  <p className="text-xs text-muted-foreground mt-1">Inactive</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        {!data?.length && <p className="text-center text-muted-foreground py-12">No holidays yet</p>}
      </QueryBoundary>
    </div>
  );
}
