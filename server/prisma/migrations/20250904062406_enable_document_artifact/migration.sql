/*
  Warnings:

  - You are about to drop the column `documentId` on the `artifacts` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[hash]` on the table `artifacts` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."artifacts" DROP CONSTRAINT "artifacts_documentId_fkey";

-- DropIndex
DROP INDEX "public"."artifacts_documentId_key";

-- AlterTable
ALTER TABLE "public"."artifacts" DROP COLUMN "documentId";

-- CreateTable
CREATE TABLE "public"."DocumentArtifact" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,

    CONSTRAINT "DocumentArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentArtifact_documentId_artifactId_key" ON "public"."DocumentArtifact"("documentId", "artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "artifacts_hash_key" ON "public"."artifacts"("hash");

-- AddForeignKey
ALTER TABLE "public"."DocumentArtifact" ADD CONSTRAINT "DocumentArtifact_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentArtifact" ADD CONSTRAINT "DocumentArtifact_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "public"."artifacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
