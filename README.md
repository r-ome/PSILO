# PSILO

- [Summary](#summary)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [AWS Architecture](#aws-architecture)
- [Key Decisions](#key-decisions)
- [Status](#status)

# Summary

P*ersonal* Silo. A personal cloud storage built with AWS, NextJS, Typescript. Designed as a self-hosted alternative to commercial storage solutions. Optimized for cost using S3 Glacier Flexible Retrieval for cold storage.

Built as a learning project to explore AWS architecture, CDK infrastructure-as-code,
and full-stack TypeScript. Integrated with Claude Code for AI-assisted development.

# Getting Started

## Prerequisites

- Node.js v22+
- AWS CLI configured with appropriate credentials
- AWS CDK v2
- An AWS account

## AWS Service (Auto-provisioned via CDK)

- Provisioned automatically via AWS CDK. See `infrastructure/` for the full stack definition.
  - Core services include:
    - Cognito - authentication
    - API Gateway + Lambda - request handling and business logic
    - S3 - object storage with lifecycle rules (originals transition to Glacier)
    - SQS + DLQ - for async metadata processing and thumbnail generation
    - EventBridge - listens for S3 storage class transitions and Glacier restore completions
    - Aurora Serverless v2 - stores users, photo metadata, storage class state, retrieval batches
    - AWS Batch (Fargate Spot) + ECR - video thumbnail and preview generation via FFmpeg
    - SES - email notifications when Glacier restores complete

# Project Structure

```
├── frontend/                        # Next.js app
├── infrastructure/                  # AWS CDK stacks
│     └── lib/constructs/            # CDK constructs (storage, database, auth, upload-pipeline, api, video-pipeline)
└── services/                        # Lambda functions
      ├── generate-presigned-url/    # Returns S3 presigned PUT URLs
      ├── manage-photos/             # List, delete, storage stats, trash
      ├── manage-albums/             # CRUD albums + album-photo associations
      ├── manage-retrieval/          # List retrieval batches and per-file restore status
      ├── request-restore/           # POST /files/restore — presigned URL or Glacier restore
      ├── handle-restore-completed/  # EventBridge — sends SES email when Glacier restore finishes
      ├── user-provisioning/         # Post-Cognito confirmation setup
      ├── process-photo-metadata/    # EXIF extraction + thumbnail gen; submits Batch jobs for videos (SQS)
      ├── lifecycle-transition/      # Tracks S3 Glacier transitions (EventBridge)
      ├── handle-upload-dlq/         # Dead-letter queue handler
      ├── batch/
      │     └── video-thumbnail-processor/  # Fargate job: FFmpeg thumbnail + 5s preview generation
      ├── shared/                    # Schema + DB client (bundled by esbuild)
      └── migrations/                # Drizzle SQL migrations
```

### Frontend

The user-facing application built with Next.js and Typescript. Handles all UI routing, and client-side logic. Communicates with backend services via API Gateway.

### Infrastructure

AWS CDK project that provisions and manages all cloud resources. Running the CDK deploy here will automatically set up all required AWS Services (Cognito, Lambda, API Gateway, etc). see `infrastructure/` for stack definitions.

### Services

Lambda functions written in Typescript, each handling a specific domain (photos, albums, etc). Deployed automatically as a part of the infrastructure stack.

# Tech Stack

| Layer          | Technology                            |
| -------------- | ------------------------------------- |
| Frontend       | Next.js, TypeScript                   |
| Backend        | AWS Lambda, Node.js v22+              |
| Database       | Aurora Serverless v2 (Drizzle ORM)    |
| Infrastructure | AWS CDK (construct-per-domain)        |
| Storage        | S3 Glacier Flexible Retrieval         |
| Auth           | Cognito                               |
| Queue          | SQS + DLQ                             |
| Video          | AWS Batch (Fargate Spot) + FFmpeg     |
| Email          | SES                                   |
| Registry       | ECR                                   |

# AWS Architecture

```mermaid
graph TD
User["User (Browser)"]
FE["Frontend<br>Next.js"]
APIGW["API Gateway"]
Cognito["Cognito<br>Auth"]
APILambda["API Lambdas<br>(manage-photos, manage-albums,<br>manage-retrieval)"]
PresignLambda["generate-presigned-url"]
RestoreLambda["request-restore"]
HandleRestoreLambda["handle-restore-completed"]
ProcessLambda["process-photo-metadata"]
LifecycleLambda["lifecycle-transition"]
DLQLambda["handle-upload-dlq"]
SQS["SQS Upload Queue"]
DLQ["Dead-Letter Queue"]
S3["S3<br>(Standard + Glacier)"]
Aurora["Aurora Serverless<br>Metadata + Retrieval Batches"]
EventBridge["EventBridge<br>S3 Events"]
Batch["AWS Batch<br>(Fargate Spot + FFmpeg)"]
ECR["ECR<br>Video Processor Image"]
SES["SES<br>Email"]

User --> FE
FE --> Cognito
FE --> APIGW
APIGW --> APILambda
APIGW --> PresignLambda
APIGW --> RestoreLambda
PresignLambda --> S3
APILambda --> S3
APILambda --> Aurora
RestoreLambda --> S3
RestoreLambda --> Aurora
S3 -->|ObjectCreated| SQS
SQS --> ProcessLambda
ProcessLambda --> S3
ProcessLambda --> Aurora
ProcessLambda -->|videos| Batch
ECR --> Batch
Batch --> S3
Batch --> Aurora
SQS -->|after 3 retries| DLQ
DLQ --> DLQLambda
S3 -->|StorageClassChanged| EventBridge
S3 -->|RestoreCompleted| EventBridge
EventBridge --> LifecycleLambda
EventBridge --> HandleRestoreLambda
LifecycleLambda --> Aurora
HandleRestoreLambda --> Aurora
HandleRestoreLambda --> SES
SES --> User
```

# Status

🚧 Currently in active development

- [x] Infrastructure Setup
- [x] Authentication (Cognito)
- [x] File Upload
- [x] File Retrieval
- [x] Album Management (CRUD, rename)
- [x] Thumbnail generation (800×800 JPEG, served from Standard)
- [x] S3 Glacier lifecycle for originals (cost optimization)
- [x] Storage usage dashboard with per-class cost breakdown + retrieval cost estimates
- [x] Infinite scroll on dashboard
- [x] Bulk photo delete
- [x] Trash bin + photo restore
- [x] Video support (upload + thumbnail cover + hover preview via AWS Batch + FFmpeg)
- [x] Full-resolution photo download (Standard: immediate presigned URL; Glacier: restore + SES email)
- [x] Glacier restore tier selection (Expedited / Standard / Bulk)
- [x] Retrieval batch tracking + restore requests page
- [x] CDK stack refactored into per-domain constructs
- [ ] Photo sorting and filtering

# Key Decisions

- **NextJS** - frontend tech stack. [ADR-001](documentation/ADRs/001-use-nextjs.md)
- **Monorepo** - repository architecture. [ADR-002](documentation/ADRs/002-implement-monorepo.md)
- **AWS** - cloud service provider. [ADR-003](documentation/ADRs/003-leverage-aws-background.md)
- **AWS S3 Glacier Flexible** - cost optimization for cold storage. [ADR-004](documentation/ADRs/004-using-S3-glacier-flexible.md)
- **AWS Aurora Serverless v2** - database [ADR-005](documentation/ADRs/005-using-aurora-serverless.md)
- **Drizzle** - database ORM. [ADR-006](documentation/ADRs/006-using-drizzle.md)
- **Backend for Frontends (BFF) Pattern** - design pattern for the App. [ADR-007](documentation/ADRs/007-using-bff-approach.md)
- **SQS for async photo metadata processing** - decoupled background processing with DLQ. [ADR-008](documentation/ADRs/008-sqs-async-photo-processing.md)
- **Aurora Data API (no VPC)** - Lambda-to-database connectivity without NAT gateways. [ADR-009](documentation/ADRs/009-aurora-data-api-no-vpc.md)
- **Thumbnail generation pipeline** - fast grid loading while keeping originals in Glacier. [ADR-010](documentation/ADRs/010-thumbnail-generation-pipeline.md)
- **EventBridge for storage class tracking** - sync Glacier transition state to DB without polling. [ADR-011](documentation/ADRs/011-eventbridge-storage-class-tracking.md)
