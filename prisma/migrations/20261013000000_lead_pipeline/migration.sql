-- Embudo de prospección: cada lead lleva su etapa, la cola de revisión de su sitio y lo
-- que esa revisión encontró. Todo es nullable o con valor por defecto, así que los leads
-- existentes quedan en "new" y se clasifican la primera vez que se revisa su base.
ALTER TABLE "leads" ADD COLUMN     "checkClaimedAt" TIMESTAMP(3),
ADD COLUMN     "checkError" TEXT,
ADD COLUMN     "checkState" TEXT,
ADD COLUMN     "checkedAt" TIMESTAMP(3),
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "finalUrl" TEXT,
ADD COLUMN     "httpStatus" INTEGER,
ADD COLUMN     "phoneDigits" TEXT,
ADD COLUMN     "placeId" TEXT,
ADD COLUMN     "siteCms" TEXT,
ADD COLUMN     "siteIssues" JSONB,
ADD COLUMN     "siteKind" TEXT,
ADD COLUMN     "siteScore" INTEGER,
ADD COLUMN     "siteStatus" TEXT,
ADD COLUMN     "siteTitle" TEXT,
ADD COLUMN     "siteWhatsapp" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "stage" TEXT NOT NULL DEFAULT 'new',
ADD COLUMN     "stageChangedAt" TIMESTAMP(3);

CREATE INDEX "leads_userId_stage_idx" ON "leads"("userId", "stage");

CREATE INDEX "leads_jobId_checkState_idx" ON "leads"("jobId", "checkState");

CREATE INDEX "leads_domain_idx" ON "leads"("domain");
