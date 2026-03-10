-- AlterTable
ALTER TABLE "CreditNote" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "CreditNote" ADD COLUMN "refundedAt" TIMESTAMP(3);
