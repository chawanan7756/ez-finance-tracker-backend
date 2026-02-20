/*
  Warnings:

  - A unique constraint covering the columns `[category,month,lineUserId]` on the table `Budget` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,lineUserId]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - Made the column `lineUserId` on table `Transaction` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Budget_category_month_key";

-- DropIndex
DROP INDEX "Category_name_key";

-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "lineUserId" TEXT NOT NULL DEFAULT 'LEGACY';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "lineUserId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "lineUserId" SET NOT NULL,
ALTER COLUMN "lineUserId" SET DEFAULT 'LEGACY';

-- CreateIndex
CREATE INDEX "Budget_lineUserId_idx" ON "Budget"("lineUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_category_month_lineUserId_key" ON "Budget"("category", "month", "lineUserId");

-- CreateIndex
CREATE INDEX "Category_lineUserId_idx" ON "Category"("lineUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_lineUserId_key" ON "Category"("name", "lineUserId");

-- CreateIndex
CREATE INDEX "Transaction_lineUserId_idx" ON "Transaction"("lineUserId");
