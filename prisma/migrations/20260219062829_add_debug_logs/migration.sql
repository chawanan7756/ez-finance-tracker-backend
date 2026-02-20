-- CreateTable
CREATE TABLE "DebugLog" (
    "id" SERIAL NOT NULL,
    "lineUserId" TEXT,
    "displayName" TEXT,
    "level" TEXT NOT NULL DEFAULT 'info',
    "tag" TEXT NOT NULL DEFAULT 'app',
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "appVersion" TEXT,
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebugLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DebugLog_lineUserId_idx" ON "DebugLog"("lineUserId");

-- CreateIndex
CREATE INDEX "DebugLog_level_idx" ON "DebugLog"("level");

-- CreateIndex
CREATE INDEX "DebugLog_createdAt_idx" ON "DebugLog"("createdAt");
