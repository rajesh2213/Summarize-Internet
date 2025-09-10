/*
  Warnings:

  - You are about to drop the `DocumentArtifact` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."DocumentArtifact" DROP CONSTRAINT "DocumentArtifact_artifactId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DocumentArtifact" DROP CONSTRAINT "DocumentArtifact_documentId_fkey";

-- AlterTable
ALTER TABLE "public"."documents" ADD COLUMN     "artifactId" TEXT;

-- DropTable
DROP TABLE "public"."DocumentArtifact";

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "public"."artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
