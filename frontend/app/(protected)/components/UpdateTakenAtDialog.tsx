"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Loader2 } from "lucide-react";
import { Photo } from "@/app/lib/services/photo.service";

interface UpdateTakenAtDialogProps {
  photo?: Photo | null;
  bulkCount?: number | null;
  onConfirm: (takenAt: string | null) => Promise<void>;
  onCancel: () => void;
}

function toDateInput(isoString: string | null): string {
  if (!isoString) return "";
  return isoString.split("T")[0];
}

function buildIsoWithCreatedAtTime(dateValue: string, createdAt: string | null): string {
  const timePart = createdAt ? createdAt.split("T")[1] : "00:00:00.000Z";
  return `${dateValue}T${timePart}`;
}

export default function UpdateTakenAtDialog({
  photo = null,
  bulkCount = null,
  onConfirm,
  onCancel,
}: UpdateTakenAtDialogProps) {
  const isBulk = bulkCount !== null && bulkCount > 0;
  const isOpen = photo !== null || isBulk;
  const [value, setValue] = useState(() => toDateInput(photo?.takenAt ?? photo?.createdAt ?? null));
  const [isUpdating, setIsUpdating] = useState(false);

  const handleConfirm = async (takenAt: string | null) => {
    setIsUpdating(true);
    await onConfirm(takenAt);
    setIsUpdating(false);
  };

  const title = isBulk
    ? `Update date for ${bulkCount} item${bulkCount === 1 ? "" : "s"}`
    : "Update taken date";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isUpdating) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <label className="text-sm text-muted-foreground">Date</label>
          <input
            type="date"
            className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => handleConfirm(null)}
            disabled={isUpdating}
          >
            Clear date
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={isUpdating}>
            Cancel
          </Button>
          <Button
            onClick={() => handleConfirm(value ? buildIsoWithCreatedAtTime(value, photo?.createdAt ?? null) : null)}
            disabled={isUpdating}
          >
            {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
