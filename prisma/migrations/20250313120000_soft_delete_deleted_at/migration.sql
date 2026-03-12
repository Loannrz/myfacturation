-- AlterTable: add deletedAt for soft delete (7-day recovery)
ALTER TABLE "Client" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "CreditNote" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Client_userId_deletedAt_idx" ON "Client"("userId", "deletedAt");
CREATE INDEX "Company_userId_deletedAt_idx" ON "Company"("userId", "deletedAt");
CREATE INDEX "Quote_userId_deletedAt_idx" ON "Quote"("userId", "deletedAt");
CREATE INDEX "Invoice_userId_deletedAt_idx" ON "Invoice"("userId", "deletedAt");
CREATE INDEX "CreditNote_userId_deletedAt_idx" ON "CreditNote"("userId", "deletedAt");
CREATE INDEX "Employee_userId_deletedAt_idx" ON "Employee"("userId", "deletedAt");
CREATE INDEX "Expense_userId_deletedAt_idx" ON "Expense"("userId", "deletedAt");
