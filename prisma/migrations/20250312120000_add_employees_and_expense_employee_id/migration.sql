-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "position" TEXT,
    "contractType" TEXT,
    "hireDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "socialSecurityNumber" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "employeeId" TEXT;

-- CreateIndex
CREATE INDEX "Employee_userId_idx" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_userId_status_idx" ON "Employee"("userId", "status");

-- CreateIndex
CREATE INDEX "Expense_employeeId_idx" ON "Expense"("employeeId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
