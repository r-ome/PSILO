import { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { eq } from 'drizzle-orm';
import { createDb } from '../../shared/db';
import { photos } from '../../shared/schema';

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const db = createDb();
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const sqsRecord of event.Records) {
    try {
      const s3Event = JSON.parse(sqsRecord.body);
      const record = s3Event.Records?.[0];
      if (!record) {
        console.warn('Missing S3 record:', sqsRecord.messageId);
        continue;
      }

      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
      await db.update(photos).set({ status: 'failed' }).where(eq(photos.s3Key, key));

      console.log(`Marked photo as failed: ${key}`);
    } catch (err) {
      console.error(`DLQ handler failed for ${sqsRecord.messageId}:`, err);
      batchItemFailures.push({ itemIdentifier: sqsRecord.messageId });
    }
  }

  return { batchItemFailures };
};
