"use client";

import { useCallback, useState } from "react";
import { Upload, FileText } from "lucide-react";

const ACCEPTED = [".pdf", ".doc", ".docx", ".md", ".txt", ".xlsx", ".xls"];

interface UploadZoneProps {
  onUpload: (files: FileList) => void;
  uploading?: boolean;
}

export function UploadZone({ onUpload, uploading }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        onUpload(e.dataTransfer.files);
      }
    },
    [onUpload]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onUpload(e.target.files);
      }
    },
    [onUpload]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
        dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
      }`}
    >
      {uploading ? (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">上传处理中...</p>
        </>
      ) : (
        <>
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            拖拽文件到此处，或点击选择文件
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            支持 PDF, DOCX, MD, TXT, XLSX
          </p>
          <label className="mt-4 cursor-pointer">
            <input
              type="file"
              multiple
              accept={ACCEPTED.join(",")}
              onChange={handleChange}
              className="hidden"
            />
            <span className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
              <FileText className="h-4 w-4" />
              选择文件
            </span>
          </label>
        </>
      )}
    </div>
  );
}
