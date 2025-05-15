/*
  Warnings:

  - You are about to drop the column `verifierContractAddress` on the `Workstep` table. All the data in the column will be lost.
  - Added the required column `workstepConfig` to the `Workstep` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Workstep" DROP COLUMN "verifierContractAddress",
ADD COLUMN     "workstepConfig" JSONB NOT NULL;
