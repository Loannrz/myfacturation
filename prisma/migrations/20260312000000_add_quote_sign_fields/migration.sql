-- AlterTable Quote: champs pour envoi et signature électronique du devis
ALTER TABLE "Quote" ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "signToken" TEXT,
ADD COLUMN "signatureImageBase64" TEXT;

CREATE UNIQUE INDEX "Quote_signToken_key" ON "Quote"("signToken");
