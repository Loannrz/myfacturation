-- CreateTable
CREATE TABLE "DeletedEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeletedEmail_email_key" ON "DeletedEmail"("email");
CREATE INDEX "DeletedEmail_email_idx" ON "DeletedEmail"("email");
