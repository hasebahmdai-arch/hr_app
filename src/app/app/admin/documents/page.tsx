"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAdminDocuments, useCreateAdminDocument } from "@/hooks/use-admin";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function DocumentsAdminPage() {
  const { data, isLoading, isError, refetch } = useAdminDocuments("documents");
  const create = useCreateAdminDocument();
  const [docOpen, setDocOpen] = useState(false);
  const [docForm, setDocForm] = useState({ title: "", fileId: "", category: "" });

  async function handleDocCreate(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ itemType: "document", ...docForm });
    setDocOpen(false);
    setDocForm({ title: "", fileId: "", category: "" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Documents"
        subtitle="Shared files for the organization"
        action={
          <Dialog open={docOpen} onOpenChange={setDocOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Document</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleDocCreate} className="space-y-4">
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
                  {docForm.fileId ? <p className="text-sm text-green-600">Uploaded</p> : null}
                  <ImageUpload
                    bucket="documents"
                    label="Upload document"
                    accept="*/*"
                    onUploaded={(id) => setDocForm({ ...docForm, fileId: id })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={create.isPending || !docForm.fileId}>
                  {create.isPending ? "Saving..." : "Create"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="grid gap-4 md:grid-cols-2">
          {data?.companyDocuments?.map((d) => (
            <Card key={d._id} className="border-0 shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{d.title}</CardTitle>
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
