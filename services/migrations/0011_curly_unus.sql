CREATE TABLE "retrieval_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"batch_type" varchar(20) NOT NULL,
	"source_id" varchar(255),
	"retrieval_tier" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"total_files" integer DEFAULT 0 NOT NULL,
	"total_size" integer DEFAULT 0 NOT NULL,
	"requested_at" timestamp DEFAULT now(),
	"available_at" timestamp,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "retrieval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"photo_id" uuid NOT NULL,
	"s3_key" varchar(1000) NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"requested_at" timestamp DEFAULT now(),
	"available_at" timestamp,
	"expires_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "retrieval_requests" ADD CONSTRAINT "retrieval_requests_batch_id_retrieval_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."retrieval_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_requests" ADD CONSTRAINT "retrieval_requests_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_retrieval_batches_user_id" ON "retrieval_batches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_retrieval_batches_source_id" ON "retrieval_batches" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_retrieval_requests_batch_id" ON "retrieval_requests" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_retrieval_requests_s3_key" ON "retrieval_requests" USING btree ("s3_key");