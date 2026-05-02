-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'HIDDEN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "isSuspended" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");
