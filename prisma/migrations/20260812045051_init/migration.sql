-- CreateTable
CREATE TABLE "leads" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "phone" TEXT,
    "rating" REAL,
    "reviewsCount" INTEGER,
    "category" TEXT,
    "address" TEXT,
    "city" TEXT,
    "website" TEXT,
    "mapsUrl" TEXT,
    "searchNiche" TEXT,
    "searchZone" TEXT,
    "countryCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "scraping_jobs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "niche" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "leadsFound" INTEGER NOT NULL DEFAULT 0,
    "apifyRunId" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
