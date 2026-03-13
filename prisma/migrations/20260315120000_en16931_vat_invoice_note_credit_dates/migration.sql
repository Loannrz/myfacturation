-- AlterTable BillingSettings: TVA assujetti / non assujetti + motif exonération
ALTER TABLE "BillingSettings" ADD COLUMN IF NOT EXISTS "vatApplicable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BillingSettings" ADD COLUMN IF NOT EXISTS "vatExemptionReason" TEXT;

-- AlterTable Invoice: note optionnelle (Factur-X)
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "note" TEXT;

-- AlterTable CreditNote: date échéance et conditions de paiement
ALTER TABLE "CreditNote" ADD COLUMN IF NOT EXISTS "dueDate" TEXT;
ALTER TABLE "CreditNote" ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT;
