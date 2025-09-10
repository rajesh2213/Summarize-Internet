/*
  Warnings:

  - Made the column `embedding` on table `Prototype` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Prototype" ALTER COLUMN "embedding" SET NOT NULL;
