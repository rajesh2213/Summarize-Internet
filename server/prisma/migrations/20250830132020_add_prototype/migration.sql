/*
  Warnings:

  - Added the required column `hash` to the `artifacts` table without a default value. This is not possible if the table is not empty.

*/
-- Ensure vector extension exists
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "public"."artifacts" ADD COLUMN     "hash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "public"."Prototype" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prototype_pkey" PRIMARY KEY ("id")
);
