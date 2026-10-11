-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_tickets_orderId_idx" ON "support_tickets"("orderId");
