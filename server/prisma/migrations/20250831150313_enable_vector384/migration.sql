/*
  Warnings:

  - You are about to drop the `Prototype` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."Prototype";

-- CreateTable
CREATE TABLE "public"."prototypes" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(384) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prototypes_pkey" PRIMARY KEY ("id")
);
