"use client";

import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/app/components/ui/accordion";
import {
  retrievalService,
  RetrievalBatch,
  RetrievalRequest,
} from "@/app/lib/services/retrieval.service";
import { formatDate } from "@/app/lib/utils";
import { differenceInDays, differenceInHours } from "date-fns";

const date_format = "MMM d, yyyy h:m aaa";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const STATUS_BADGE: Record<
  RetrievalBatch["status"],
  { label: string; className: string }
> = {
  PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
  PARTIAL: { label: "Partial", className: "bg-orange-100 text-orange-800" },
  AVAILABLE: { label: "Available", className: "bg-green-100 text-green-800" },
  EXPIRED: { label: "Expired", className: "bg-gray-100 text-gray-600" },
  FAILED: { label: "Failed", className: "bg-red-100 text-red-800" },
};

const REQUEST_STATUS_BADGE: Record<
  RetrievalRequest["status"],
  { label: string; className: string }
> = {
  PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
  AVAILABLE: { label: "Available", className: "bg-green-100 text-green-800" },
  EXPIRED: { label: "Expired", className: "bg-gray-100 text-gray-600" },
  FAILED: { label: "Failed", className: "bg-red-100 text-red-800" },
};

function StatusBadge({ status }: { status: RetrievalBatch["status"] }) {
  const { label, className } = STATUS_BADGE[status] ?? STATUS_BADGE.PENDING;
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${className}`}
    >
      {label}
    </span>
  );
}

function RequestStatusBadge({
  status,
}: {
  status: RetrievalRequest["status"];
}) {
  const { label, className } =
    REQUEST_STATUS_BADGE[status] ?? REQUEST_STATUS_BADGE.PENDING;
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${className}`}
    >
      {label}
    </span>
  );
}

function BatchDetail({ batchId }: { batchId: string }) {
  const [requests, setRequests] = useState<RetrievalRequest[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    retrievalService
      .getBatch(batchId)
      .then((data) => setRequests(data.requests))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [batchId]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">No files found.</p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted-foreground border-b">
          <th className="pb-1 pr-4 font-medium">File</th>
          <th className="pb-1 pr-4 font-medium">Size</th>
          <th className="pb-1 pr-4 font-medium">Status</th>
          <th className="pb-1 pr-4 font-medium">Available At</th>
          <th className="pb-1 pr-4 font-medium">Expires</th>
          <th className="pb-1 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {requests.map((req) => (
          <tr key={req.id} className="border-b last:border-0 hover:bg-gray-100">
            <td className="py-1.5 pr-4 max-w-50 truncate">
              {req.filename ?? req.s3Key.split("/").pop()}
            </td>
            <td className="py-1.5 pr-4 text-muted-foreground">
              {formatBytes(req.fileSize)}
            </td>
            <td className="py-1.5 pr-4">
              <RequestStatusBadge status={req.status} />
            </td>
            <td className="py-1.5 pr-4 text-muted-foreground">
              {req.availableAt ? formatDate(req.availableAt, date_format) : "—"}
            </td>
            <td className="py-1.5 pr-4 text-muted-foreground">
              {req.expiresAt
                ? (() => {
                    const now = new Date();
                    const exp = new Date(req.expiresAt);
                    const days = differenceInDays(exp, now);
                    const hours = differenceInHours(exp, now);
                    if (hours <= 0) return "Expired";
                    if (days < 1) return `${hours}h left`;
                    return `${days}d left`;
                  })()
                : "—"}
            </td>
            <td className="py-1.5">
              {req.retrievalLink && (
                <a
                  href={req.retrievalLink}
                  download
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Download
                </a>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function RestoreRequestsPage() {
  const [batches, setBatches] = useState<RetrievalBatch[] | null>(null);

  useEffect(() => {
    retrievalService
      .listBatches()
      .then((data) => setBatches(data.batches))
      .catch(() => setBatches([]));
  }, []);

  if (batches === null) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Restore Requests</h1>

      {batches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No restore requests yet.
        </p>
      ) : (
        <Accordion type="single" collapsible className="w-full">
          {batches.map((batch) => (
            <AccordionItem key={batch.id} value={batch.id}>
              <AccordionTrigger className="hover:no-underline cursor-pointer hover:bg-gray-100">
                <div className="flex items-center gap-4 text-sm w-full mr-2">
                  <span className="font-medium capitalize">
                    {batch.batchType.toLowerCase()}
                  </span>
                  <span className="text-muted-foreground capitalize">
                    {batch.retrievalTier.toLowerCase()}
                  </span>
                  <StatusBadge status={batch.status} />
                  <span className="text-muted-foreground">
                    {batch.totalFiles} file{batch.totalFiles !== 1 ? "s" : ""}
                    {batch.totalSize > 0 &&
                      ` · ${formatBytes(batch.totalSize)}`}
                  </span>
                  <span className="text-muted-foreground ml-auto text-xs">
                    {batch.requestedAt
                      ? formatDate(batch.requestedAt, date_format)
                      : ""}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <BatchDetail batchId={batch.id} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
