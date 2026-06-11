-- CreateTable
CREATE TABLE "content_ingestion_runs" (
    "id" UUID NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'running',
    "articles_found" INTEGER NOT NULL DEFAULT 0,
    "articles_new" INTEGER NOT NULL DEFAULT 0,
    "articles_dup" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_ingestion_runs_source_created_at_idx" ON "content_ingestion_runs"("source", "created_at" DESC);
