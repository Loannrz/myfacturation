-- CreateTable: messages affichés sur le dashboard utilisateur (admin choisit 0 à 10 actifs)
CREATE TABLE "DashboardMessage" (
  "id" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DashboardMessage_pkey" PRIMARY KEY ("id")
);
