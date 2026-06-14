-- CreateTable
CREATE TABLE "UserNarrativePreference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerDistance" TEXT NOT NULL DEFAULT 'max',
    "playerViewportX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "playerViewportY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "playerViewportZoom" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNarrativePreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserNarrativePreference_organizationId_userId_idx" ON "UserNarrativePreference"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserNarrativePreference_organizationId_userId_key" ON "UserNarrativePreference"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "UserNarrativePreference" ADD CONSTRAINT "UserNarrativePreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNarrativePreference" ADD CONSTRAINT "UserNarrativePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
