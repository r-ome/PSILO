"use client";

import { useEffect, useState } from "react";
import { photoService, StorageSize } from "@/app/lib/services/photo.service";
import {
  retrievalService,
  RetrievalBatch,
} from "@/app/lib/services/retrieval.service";
import { InfoIcon, Loader2Icon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/app/components/ui/tooltip";
import { formatStorage, convertUsdToPhp } from "@/app/lib/utils";

const TIER_INFO: Record<
  string,
  {
    speed: string;
    cost: string;
    costUsdPerGB: number;
    costUsdPer1000Req: number;
  }
> = {
  EXPEDITED: {
    speed: "1–5 minutes",
    cost: "$0.03/GB + $0.01/1,000 requests",
    costUsdPerGB: 0.03,
    costUsdPer1000Req: 0.01,
  },
  STANDARD: {
    speed: "3–5 hours",
    cost: "$0.01/GB + $0.05/1,000 requests",
    costUsdPerGB: 0.01,
    costUsdPer1000Req: 0.05,
  },
  BULK: {
    speed: "5–12 hours",
    cost: "$0.025/1,000 requests",
    costUsdPerGB: 0,
    costUsdPer1000Req: 0.025,
  },
};

export default function StoragePage() {
  const [storageData, setStorageData] = useState<StorageSize | null>(null);
  const [batches, setBatches] = useState<RetrievalBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [storageResult, batchesResult] = await Promise.all([
          photoService.getStorageSize(),
          retrievalService.listBatches(),
        ]);
        setStorageData(storageResult);
        setBatches(batchesResult.batches);
        setError(null);
      } catch (err) {
        setError("Failed to load storage information");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const standardSizeGB = (storageData?.standardSize ?? 0) / 1024 ** 3;
  const glacierSizeGB = (storageData?.glacierSize ?? 0) / 1024 ** 3;
  const thumbnailSizeGB = (storageData?.thumbnailSize ?? 0) / 1024 ** 3;
  const standardCount = storageData?.standardCount ?? 0;

  const standardCost = standardSizeGB * 0.025; // $0.025/GB/month
  const glacierCost = glacierSizeGB * 0.0045; // $0.0045/GB/month
  const thumbnailCost = thumbnailSizeGB * 0.025; // $0.025/GB/month
  const transitionCost = (standardCount / 1000) * 0.03; // $0.03 per 1000 transitions
  const totalCost = standardCost + glacierCost + thumbnailCost + transitionCost;

  // Calculate retrieval request statistics
  const totalRequests = batches.length;
  const requestsByTier = batches.reduce(
    (acc, batch) => {
      const tier = batch.retrievalTier;
      acc[tier] = (acc[tier] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Per-tier retrieval sizes from the storage-size endpoint
  const retrievalSizeByTierGB = {
    EXPEDITED:
      (storageData?.retrievalSizeByTier?.["EXPEDITED"] ?? 0) / 1024 ** 3,
    STANDARD: (storageData?.retrievalSizeByTier?.["STANDARD"] ?? 0) / 1024 ** 3,
    BULK: (storageData?.retrievalSizeByTier?.["BULK"] ?? 0) / 1024 ** 3,
  };

  // Calculate cost per tier using each tier's own size
  const costByTier = {
    EXPEDITED:
      retrievalSizeByTierGB.EXPEDITED * 0.03 +
      ((requestsByTier["EXPEDITED"] ?? 0) * 0.01) / 1000,
    STANDARD:
      retrievalSizeByTierGB.STANDARD * 0.01 +
      ((requestsByTier["STANDARD"] ?? 0) * 0.05) / 1000,
    BULK: ((requestsByTier["BULK"] ?? 0) * 0.025) / 1000,
  };
  const totalRetrievalCost =
    costByTier.EXPEDITED + costByTier.STANDARD + costByTier.BULK;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Storage</h1>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-red-500">{error}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Standard Storage</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">
                    {formatStorage(storageData?.standardSize ?? 0)}
                  </p>
                  <p className="text-gray-500 mt-2">
                    {(storageData?.standardPhotoCount ?? 0).toLocaleString()}{" "}
                    photos,{" "}
                    {(storageData?.standardVideoCount ?? 0).toLocaleString()}{" "}
                    videos
                  </p>
                  <p className="text-gray-500 mt-2">
                    ${standardCost.toFixed(6)} / ₱
                    {convertUsdToPhp(standardCost).toFixed(2)} per month
                  </p>
                  <p className="text-sm text-gray-400 mt-1">$0.025/GB/month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Glacier Archive</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">
                    {formatStorage(storageData?.glacierSize ?? 0)}
                  </p>
                  <p className="text-gray-500 mt-2">
                    {(storageData?.glacierPhotoCount ?? 0).toLocaleString()}{" "}
                    photos,{" "}
                    {(storageData?.glacierVideoCount ?? 0).toLocaleString()}{" "}
                    videos
                  </p>
                  <p className="text-gray-500 mt-2">
                    ${glacierCost.toFixed(6)} / ₱
                    {convertUsdToPhp(glacierCost).toFixed(2)} per month
                  </p>
                  <p className="text-sm text-gray-400 mt-1">$0.0045/GB/month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Thumbnails</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">
                    {formatStorage(storageData?.thumbnailSize ?? 0)}
                  </p>
                  <p className="text-gray-500 mt-2">
                    ${thumbnailCost.toFixed(6)} / ₱
                    {convertUsdToPhp(thumbnailCost).toFixed(2)} per month
                  </p>
                  <p className="text-sm text-gray-400 mt-1">$0.025/GB/month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Transition Fees</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">
                    {standardCount.toLocaleString()} Objects
                  </p>
                  <p className="text-gray-500 mt-2">
                    ${transitionCost.toFixed(6)} / ₱
                    {convertUsdToPhp(transitionCost).toFixed(2)} one-time
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    $0.03 per 1000 objects
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Restore Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">
                    {totalRequests.toLocaleString()} Requests
                  </p>
                  <p className="text-gray-500 mt-2">
                    ₱{convertUsdToPhp(totalRetrievalCost).toFixed(2)} / $
                    {totalRetrievalCost.toFixed(6)} total
                  </p>
                  <div className="space-y-3 mt-4">
                    {["EXPEDITED", "STANDARD", "BULK"].map((tier) => {
                      const count = requestsByTier[tier] ?? 0;
                      const cost =
                        costByTier[tier as keyof typeof costByTier] ?? 0;
                      const info = TIER_INFO[tier];
                      const tierBytes =
                        storageData?.retrievalSizeByTier?.[tier] ?? 0;
                      return (
                        <div
                          key={tier}
                          className="flex justify-between items-center"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-gray-600 font-medium">
                                {tier}
                              </p>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                                    aria-label={`Info for ${tier} tier`}
                                  >
                                    <InfoIcon className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="right"
                                  className="max-w-56 space-y-1 p-3"
                                >
                                  <p className="font-medium">{tier} Tier</p>
                                  <p>{info.speed}</p>
                                  <p>{info.cost}</p>
                                  <p>
                                    ₱{convertUsdToPhp(cost).toFixed(2)} ($
                                    {cost.toFixed(6)}) total
                                  </p>
                                  <p>{formatStorage(tierBytes)} retrieved</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <p className="text-sm text-gray-500">
                              {count.toLocaleString()} request
                              {count !== 1 ? "s" : ""} · {info.speed}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-600 font-medium">
                              ₱{convertUsdToPhp(cost).toFixed(2)}
                            </p>
                            <p className="text-sm text-gray-500">
                              ${cost.toFixed(6)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Total Estimated Cost</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">
                    ${totalCost.toFixed(6)} / ₱
                    {convertUsdToPhp(totalCost).toFixed(2)}
                  </p>
                  <p className="text-gray-500 mt-2">Estimated monthly total</p>
                  <div className="text-sm text-gray-400 mt-3 space-y-1">
                    <p>
                      Standard: ${standardCost.toFixed(6)} / ₱
                      {convertUsdToPhp(standardCost).toFixed(2)}/month
                    </p>
                    <p>
                      Glacier: ${glacierCost.toFixed(6)} / ₱
                      {convertUsdToPhp(glacierCost).toFixed(2)}/month
                    </p>
                    <p>
                      Thumbnails: ${thumbnailCost.toFixed(6)} / ₱
                      {convertUsdToPhp(thumbnailCost).toFixed(2)}/month
                    </p>
                    <p>
                      Transition: ${transitionCost.toFixed(6)} / ₱
                      {convertUsdToPhp(transitionCost).toFixed(2)} one-time
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
