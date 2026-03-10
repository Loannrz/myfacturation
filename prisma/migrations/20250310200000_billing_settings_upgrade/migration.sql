-- AlterTable: add company/payment/legal and prefix fields to BillingSettings
ALTER TABLE "BillingSettings" ADD COLUMN IF NOT EXISTS "apeCode" TEXT;
ALTER TABLE "BillingSettings" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "BillingSettings" ADD COLUMN IF NOT EXISTS "invoicePrefix" TEXT;
ALTER TABLE "BillingSettings" ADD COLUMN IF NOT EXISTS "quotePrefix" TEXT;
ALTER TABLE "BillingSettings" ADD COLUMN IF NOT EXISTS "creditNotePrefix" TEXT;
ALTER TABLE "BillingSettings" ADD COLUMN IF NOT EXISTS "defaultPaymentMethod" TEXT;
ALTER TABLE "BillingSettings" ADD COLUMN IF NOT EXISTS "defaultPaymentTerms" TEXT;
ALTER TABLE "BillingSettings" ADD COLUMN IF NOT EXISTS "legalPenaltiesText" TEXT;
ALTER TABLE "BillingSettings" ADD COLUMN IF NOT EXISTS "legalRecoveryFeeText" TEXT;
