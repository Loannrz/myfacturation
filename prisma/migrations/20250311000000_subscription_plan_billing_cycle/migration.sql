-- AlterTable
ALTER TABLE "User" ADD COLUMN "subscriptionPlan" TEXT NOT NULL DEFAULT 'starter';
ALTER TABLE "User" ADD COLUMN "billingCycle" TEXT;

-- Backfill: existing premium users
UPDATE "User" SET "subscriptionPlan" = 'pro' WHERE "planType" = 'premium';
