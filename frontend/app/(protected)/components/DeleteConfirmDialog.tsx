import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import { Photo } from "@/app/lib/services/photo.service";

interface DeleteConfirmDialogProps {
  photo?: Photo | null;
  bulkCount?: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmDialog({
  photo = null,
  bulkCount = null,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const isBulk = bulkCount !== null && bulkCount > 0;
  const isOpen = photo !== null || isBulk;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBulk ? `Delete ${bulkCount} photo${bulkCount === 1 ? "" : "s"}?` : "Delete photo?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk
              ? `Are you sure you want to delete ${bulkCount} photo${bulkCount === 1 ? "" : "s"}? This action cannot be undone.`
              : `Are you sure you want to delete "${photo?.filename}"? This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
