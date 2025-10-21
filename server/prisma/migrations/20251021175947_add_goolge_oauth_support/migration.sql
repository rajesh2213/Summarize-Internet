/*
  Warnings:

  - A unique constraint covering the columns `[google_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "auth_provider" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN     "google_id" TEXT,
ADD COLUMN     "profile_picture" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "public"."users"("google_id");
