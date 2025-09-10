/*
  Warnings:

  - A unique constraint covering the columns `[documentId]` on the table `artifacts` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "artifacts_documentId_key" ON "public"."artifacts"("documentId");
