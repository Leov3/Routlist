-- CreateTable
CREATE TABLE "UserBoardPreference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewMode" TEXT NOT NULL DEFAULT 'simple',
    "density" TEXT NOT NULL DEFAULT 'medium',
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBoardPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioButtonFavorite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "audioButtonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioButtonFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserBoardPreference_organizationId_userId_idx" ON "UserBoardPreference"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBoardPreference_organizationId_userId_key" ON "UserBoardPreference"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "AudioButtonFavorite_organizationId_userId_idx" ON "AudioButtonFavorite"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AudioButtonFavorite_organizationId_userId_audioButtonId_key" ON "AudioButtonFavorite"("organizationId", "userId", "audioButtonId");

-- AddForeignKey
ALTER TABLE "UserBoardPreference" ADD CONSTRAINT "UserBoardPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBoardPreference" ADD CONSTRAINT "UserBoardPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioButtonFavorite" ADD CONSTRAINT "AudioButtonFavorite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioButtonFavorite" ADD CONSTRAINT "AudioButtonFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioButtonFavorite" ADD CONSTRAINT "AudioButtonFavorite_audioButtonId_fkey" FOREIGN KEY ("audioButtonId") REFERENCES "AudioButton"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
