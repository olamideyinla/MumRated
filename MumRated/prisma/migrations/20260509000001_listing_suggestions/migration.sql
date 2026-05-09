-- CreateTable
CREATE TABLE "ListingSuggestion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ListingType" NOT NULL,
    "categoryHint" TEXT,
    "description" TEXT,
    "submitterEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingSuggestion_createdAt_idx" ON "ListingSuggestion"("createdAt" DESC);
