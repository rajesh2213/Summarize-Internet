/*
  Warnings:

  - You are about to drop the column `input` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `summary` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `summary_url` on the `transactions` table. All the data in the column will be lost.
  - Added the required column `documentId` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."SummaryType" AS ENUM ('BULLET_POINTS', 'PARAGRAPH', 'TLDR', 'QUESTION_ANSWER');

-- DropForeignKey
ALTER TABLE "public"."transactions" DROP CONSTRAINT "transactions_user_id_fkey";

-- AlterTable
ALTER TABLE "public"."transactions" DROP COLUMN "input",
DROP COLUMN "source",
DROP COLUMN "summary",
DROP COLUMN "summary_url",
ADD COLUMN     "documentId" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'QUEUED',
ALTER COLUMN "user_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."documents" (
    "id" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT,
    "text" TEXT,
    "source" "public"."Source" NOT NULL,
    "status" "public"."Status" NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Summary" (
    "id" TEXT NOT NULL,
    "type" "public"."SummaryType" NOT NULL,
    "content" JSONB NOT NULL,
    "artifactUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId" TEXT NOT NULL,

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Summary" ADD CONSTRAINT "Summary_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
