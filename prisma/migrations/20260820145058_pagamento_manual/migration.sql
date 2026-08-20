-- AlterEnum
ALTER TYPE "PaymentKind" ADD VALUE 'MANUAL';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "notes" TEXT;
