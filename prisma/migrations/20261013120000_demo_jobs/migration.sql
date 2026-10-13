-- Cola de demos: cada negocio candidato tiene trabajos que toma el worker de la Mac
-- (auditoría visual, investigación, construcción y publicación). Solo agrega columnas y tablas.

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "demoSlug" TEXT,
ADD COLUMN     "demoUrl" TEXT;

-- CreateTable
CREATE TABLE "demo_jobs" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "step" TEXT,
    "log" JSONB NOT NULL DEFAULT '[]',
    "workerId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "forced" BOOLEAN NOT NULL DEFAULT false,
    "notBefore" TIMESTAMP(3),
    "slug" TEXT,
    "demoUrl" TEXT,
    "audit" JSONB,
    "research" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "version" TEXT,
    "running" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "pausedUntil" TIMESTAMP(3),
    "pauseReason" TEXT,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "demo_jobs_status_createdAt_idx" ON "demo_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "demo_jobs_leadId_idx" ON "demo_jobs"("leadId");

-- CreateIndex
CREATE INDEX "demo_jobs_userId_status_idx" ON "demo_jobs"("userId", "status");

-- AddForeignKey
ALTER TABLE "demo_jobs" ADD CONSTRAINT "demo_jobs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
