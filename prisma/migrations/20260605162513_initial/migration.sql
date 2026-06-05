-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('anthropic', 'google', 'openai');

-- CreateEnum
CREATE TYPE "ModelTier" AS ENUM ('fast', 'balanced', 'best');

-- CreateEnum
CREATE TYPE "DepthPreset" AS ENUM ('overview', 'standard', 'deep_dive');

-- CreateEnum
CREATE TYPE "ThemePreset" AS ENUM ('dark', 'light', 'high_contrast');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('pending', 'processing', 'done', 'error');

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "keyConcepts" JSONB NOT NULL DEFAULT '[]',
    "prerequisiteLevel" TEXT,
    "chapterDescriptions" JSONB NOT NULL DEFAULT '{}',
    "provider" "Provider" NOT NULL DEFAULT 'anthropic',
    "modelTier" "ModelTier" NOT NULL DEFAULT 'balanced',
    "depthPreset" "DepthPreset" NOT NULL DEFAULT 'standard',
    "themePreset" "ThemePreset" NOT NULL DEFAULT 'dark',
    "voice" TEXT,
    "skipManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunks" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'pending',
    "codeBlocks" JSONB NOT NULL DEFAULT '[]',
    "principles" JSONB NOT NULL DEFAULT '[]',
    "prevChunkId" TEXT,
    "nextChunkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summaries" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_scripts" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chapters_bookId_idx" ON "chapters"("bookId");

-- CreateIndex
CREATE INDEX "chunks_chapterId_position_idx" ON "chunks"("chapterId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "summaries_chapterId_key" ON "summaries"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "video_scripts_chapterId_key" ON "video_scripts"("chapterId");

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_scripts" ADD CONSTRAINT "video_scripts_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
