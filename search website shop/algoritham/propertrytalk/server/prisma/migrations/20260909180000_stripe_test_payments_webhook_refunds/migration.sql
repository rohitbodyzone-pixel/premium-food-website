-- AlterTable
ALTER TABLE "Refund" ADD COLUMN "originalAmountMinorUnits" INTEGER;
ALTER TABLE "Refund" ADD COLUMN "refundedAmountMinorUnits" INTEGER;
ALTER TABLE "Refund" ADD COLUMN "remainingAmountMinorUnits" INTEGER;

-- AlterTable
ALTER TABLE "LiveViewingParticipant" ADD COLUMN "refundStatus" TEXT;
ALTER TABLE "LiveViewingParticipant" ADD COLUMN "reservationExpiresAt" DATETIME;

-- CreateTable
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PaymentTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idempotencyKey" TEXT NOT NULL,
    "billingSessionId" TEXT,
    "paymentType" TEXT NOT NULL DEFAULT 'CONSULTATION',
    "liveViewingSessionId" TEXT,
    "liveViewingParticipantId" TEXT,
    "consumerId" TEXT NOT NULL,
    "expertId" TEXT,
    "amountMinorUnits" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentIntentId" TEXT,
    "providerChargeId" TEXT,
    "status" TEXT NOT NULL,
    "receiptUrl" TEXT,
    "failureReason" TEXT,
    "refundedAmountMinorUnits" INTEGER NOT NULL DEFAULT 0,
    "remainingAmountMinorUnits" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentTransaction_billingSessionId_fkey" FOREIGN KEY ("billingSessionId") REFERENCES "ConsultationBillingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentTransaction_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentTransaction_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "ExpertProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PaymentTransaction" ("amountMinorUnits", "billingSessionId", "consumerId", "createdAt", "currency", "expertId", "failureReason", "id", "idempotencyKey", "provider", "providerChargeId", "providerPaymentIntentId", "receiptUrl", "status", "updatedAt") SELECT "amountMinorUnits", "billingSessionId", "consumerId", "createdAt", "currency", "expertId", "failureReason", "id", "idempotencyKey", "provider", "providerChargeId", "providerPaymentIntentId", "receiptUrl", "status", "updatedAt" FROM "PaymentTransaction";
DROP TABLE "PaymentTransaction";
ALTER TABLE "new_PaymentTransaction" RENAME TO "PaymentTransaction";
CREATE UNIQUE INDEX "PaymentTransaction_idempotencyKey_key" ON "PaymentTransaction"("idempotencyKey");
CREATE UNIQUE INDEX "PaymentTransaction_billingSessionId_key" ON "PaymentTransaction"("billingSessionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
