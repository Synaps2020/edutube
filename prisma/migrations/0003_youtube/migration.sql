-- AlterTable
ALTER TABLE "Media" ADD COLUMN "youtubeVideoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Media_youtubeVideoId_key" ON "Media"("youtubeVideoId");
