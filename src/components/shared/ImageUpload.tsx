"use client";

import { useCallback, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { Upload, Loader2 } from "lucide-react";
import { uploadFile } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ImageUploadProps {
  bucket?: string;
  onUploaded: (fileId: string) => void;
  className?: string;
  label?: string;
  accept?: string;
  employeeId?: string;
}

export function ImageUpload({
  bucket = "avatars",
  onUploaded,
  className,
  label = "Upload image",
  accept = "image/*",
  employeeId,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = useCallback(
    async (file: File) => {
      setError("");
      setUploading(true);
      try {
        const toUpload =
          file.type.startsWith("image/")
            ? await imageCompression(file, {
                maxSizeMB: 1,
                maxWidthOrHeight: 1024,
                useWebWorker: true,
              })
            : file;
        const result = await uploadFile(
          toUpload,
          bucket,
          employeeId ? { employeeId } : undefined
        );
        onUploaded(result._id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [bucket, employeeId, onUploaded]
  );

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        {uploading ? "Uploading..." : label}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
