-- CreateEnum
CREATE TYPE "DivisionType" AS ENUM ('day', 'muscleGroup');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activePlanId" INTEGER;

-- CreateTable
CREATE TABLE "WorkoutPlan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "trainerId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutDivision" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DivisionType" NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "WorkoutDivision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" SERIAL NOT NULL,
    "divisionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "repetitions" INTEGER NOT NULL,
    "notes" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "localDate" DATE NOT NULL,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkoutPlan_trainerId_idx" ON "WorkoutPlan"("trainerId");

-- CreateIndex
CREATE INDEX "WorkoutPlan_memberId_idx" ON "WorkoutPlan"("memberId");

-- CreateIndex
CREATE INDEX "WorkoutDivision_planId_idx" ON "WorkoutDivision"("planId");

-- CreateIndex
CREATE INDEX "Exercise_divisionId_idx" ON "Exercise"("divisionId");

-- CreateIndex
CREATE INDEX "CheckIn_memberId_checkedInAt_idx" ON "CheckIn"("memberId", "checkedInAt");

-- CreateIndex
CREATE INDEX "CheckIn_checkedInAt_idx" ON "CheckIn"("checkedInAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_memberId_localDate_key" ON "CheckIn"("memberId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "User_activePlanId_key" ON "User"("activePlanId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activePlanId_fkey" FOREIGN KEY ("activePlanId") REFERENCES "WorkoutPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutDivision" ADD CONSTRAINT "WorkoutDivision_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WorkoutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "WorkoutDivision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
