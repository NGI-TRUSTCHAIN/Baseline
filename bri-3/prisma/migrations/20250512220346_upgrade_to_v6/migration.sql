-- AlterTable
ALTER TABLE "_BpiAccountToBpiSubjectAccount" ADD CONSTRAINT "_BpiAccountToBpiSubjectAccount_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_BpiAccountToBpiSubjectAccount_AB_unique";

-- AlterTable
ALTER TABLE "_BpiSubjectToBpiSubjectRole" ADD CONSTRAINT "_BpiSubjectToBpiSubjectRole_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_BpiSubjectToBpiSubjectRole_AB_unique";

-- AlterTable
ALTER TABLE "_WorkflowToWorkstep" ADD CONSTRAINT "_WorkflowToWorkstep_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_WorkflowToWorkstep_AB_unique";

-- AlterTable
ALTER TABLE "_administratorSubjects" ADD CONSTRAINT "_administratorSubjects_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_administratorSubjects_AB_unique";

-- AlterTable
ALTER TABLE "_participantSubjects" ADD CONSTRAINT "_participantSubjects_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_participantSubjects_AB_unique";
