-- AlterTable Company: vatExempt pour destinataires non assujettis à la TVA
ALTER TABLE "Company" ADD COLUMN "vatExempt" BOOLEAN NOT NULL DEFAULT false;
