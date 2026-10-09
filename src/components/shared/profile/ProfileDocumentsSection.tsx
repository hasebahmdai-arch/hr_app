"use client";

import { useState } from "react";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateEmployeeDocument, useDeleteEmployeeDocument } from "@/hooks/use-profile";

interface EmployeeDocument {
  _id: string;
  fileId?: string;
  title?: string;
  type?: string;
}

export function ProfileDocumentsSection({
  employeeId,
  documents,
  canUpload,
}: {
  employeeId: string;
  documents: EmployeeDocument[];
  canUpload: boolean;
}) {
  const create = useCreateEmployeeDocument(employeeId);
  const remove = useDeleteEmployeeDocument(employeeId);
  const [title, setTitle] = useState("");
  const [fileId, setFileId] = useState("");
  const [error, setError] = useState("");

  async function handleAdd() {
    setError("");
    if (!title.trim() || !fileId) {
      setError("Title and file are required");
      return;
    }
    try {
      await create.mutateAsync({ title: title.trim(), fileId, type: "general" });
      setTitle("");
      setFileId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save document");
    }
  }

  return (
    <div className="space-y-4">
      {documents.length ? (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li key={d._id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
              <a
                href={d.fileId ? `/api/files/${d.fileId}` : "#"}
                target="_blank"
                rel="noopener"
                className="text-sm text-primary hover:underline truncate"
              >
                {d.title || "Document"}
              </a>
              {canUpload && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 shrink-0"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(d._id)}
                >
                  {remove.isPending ? "Removing..." : "Remove"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {canUpload ? "No documents uploaded yet" : "No documents available"}
        </p>
      )}

      {canUpload && (
        <div className="space-y-3 pt-2 border-t">
          <p className="text-sm font-medium">Upload document</p>
          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. National ID, Contract"
            />
          </div>
          <div>
            <Label>File</Label>
            {fileId ? <p className="text-sm text-green-600 mb-1">File ready</p> : null}
            <ImageUpload
              bucket="documents"
              label="Choose file"
              accept="*/*"
              employeeId={employeeId}
              onUploaded={(id) => setFileId(id)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            type="button"
            size="sm"
            disabled={create.isPending || !title.trim() || !fileId}
            onClick={handleAdd}
          >
            {create.isPending ? "Saving..." : "Add Document"}
          </Button>
        </div>
      )}
    </div>
  );
}
