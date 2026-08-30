-- A database without this singleton marker is never accepted silently by startup.
CREATE TABLE "system_state" (
    "key" TEXT NOT NULL,
    "initializedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_state_pkey" PRIMARY KEY ("key")
);
