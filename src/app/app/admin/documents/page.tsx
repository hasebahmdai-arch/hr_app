"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  useAdminDocuments,
  useCreateAdminDocument,
  useDeleteCompanyDocument,
  useUpdateCompanyDocument,
} from "@/hooks/use-admin";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toastSuccess } from "@/lib/toast";

const emptyForm = { title: "", fileId: "", fileName: "", category: "" };

export default function DocumentsAdminPage() {
  const { data, isLoading, isError, refetch } = useAdminDocuments("documents");
  const create = useCreateAdminDocument();
  const update = useUpdateCompanyDocument();
  const remove = useDeleteCompanyDocument();
  const [docOpen, setDocOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [docForm, setDocForm] = useState(emptyForm);

  function openCreate() {
    setEditingId(null);
    setDocForm(emptyForm);
    setDocOpen(true);
  }

  function openEdit(d: { _id: string; title: string; fileId?: string; category?: string }) {
    setEditingId(d._id);
    setDocForm({
      title: d.title,
      fileId: d.fileId ?? "",
      fileName: "",
      category: d.category ?? "",
    });
    setDocOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingId) {
        await update.mutateAsync({
          id: editingId,
          title: docForm.title,
          fileId: docForm.fileId,
          category: docForm.category,
        });
        toastSuccess("Document updated");
      } else {
        await create.mutateAsync({
          itemType: "document",
          title: docForm.title,
          fileId: docForm.fileId,
          category: docForm.category,
        });
        toastSuccess("Document created");
      }
      setDocOpen(false);
      setEditingId(null);
      setDocForm(emptyForm);
    } catch {
      /* mutationCache toasts the error */
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document?")) return;
    try {
      await remove.mutateAsync(id);
      toastSuccess("Document deleted");
    } catch {
      /* mutationCache toasts the error */
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Documents"
        subtitle="Shared files for the organization"
        action={
          <Dialog
            open={docOpen}
            onOpenChange={(next) => {
              setDocOpen(next);
              if (!next) {
                setEditingId(null);
                setDocForm(emptyForm);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" />
                Add Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Document" : "New Document"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={docForm.title}
                    onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input
                    value={docForm.category}
                    onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}
                  />
                </div>
                <div>
                  <Label>File</Label>
                  <ImageUpload
                    bucket="documents"
                    label="Upload document"
                    previewMode="filename"
                    value={docForm.fileId || undefined}
                    filename={docForm.fileName || undefined}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    onUploaded={(file) =>
                      setDocForm({ ...docForm, fileId: file._id, fileName: file.filename })
                    }
                    onClear={() => setDocForm({ ...docForm, fileId: "", fileName: "" })}
                  />
                </div>
                <LoadingButton
                  type="submit"
                  className="w-full"
                  loading={saving}
                  disabled={!docForm.fileId}
                >
                  {editingId ? "Save" : "Create"}
                </LoadingButton>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="grid gap-4 md:grid-cols-2">
          {data?.companyDocuments?.map((d) => (
            <Card key={d._id} className="border-0 shadow-card">
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <CardTitle className="text-base">{d.title}</CardTitle>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(d)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <LoadingButton
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600"
                    loading={remove.isPending && remove.variables === d._id}
                    onClick={() => handleDelete(d._id)}
                  >
                    {!(remove.isPending && remove.variables === d._id) && (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </LoadingButton>
                </div>
              </CardHeader>
              <CardContent>
                {d.category && <p className="text-sm text-muted-foreground">{d.category}</p>}
                {d.fileId && (
                  <a
                    href={`/api/files/${d.fileId}`}
                    target="_blank"
                    rel="noopener"
                    className="text-sm text-primary hover:underline"
                  >
                    View file
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
          {!data?.companyDocuments?.length && (
            <p className="text-center text-muted-foreground py-8 md:col-span-2">No documents yet</p>
          )}
        </div>
      </QueryBoundary>
    </div>
  );
}
