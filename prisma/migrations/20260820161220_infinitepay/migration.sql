-- AlterEnum
ALTER TYPE "PaymentKind" ADD VALUE 'INFINITEPAY';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "gatewaySlug" TEXT,
ADD COLUMN     "gatewayTransactionNsu" TEXT;
