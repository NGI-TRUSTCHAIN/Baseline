import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaMapper } from '../../../../shared/prisma/prisma.mapper';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { NOT_FOUND_ERR_MESSAGE } from '../api/err.messages';
import { Workstep } from '../models/workstep';
import { Prisma } from '@prisma/client';

// Storage Agents are the only places that talk the Prisma language of models.
// They are always mapped to and from domain objects so that the business layer of the application
// does not have to care about the ORM.
@Injectable()
export class WorkstepStorageAgent {
  constructor(
    private readonly mapper: PrismaMapper,
    private readonly prisma: PrismaService,
  ) {}

  async getWorkstepById(id: string): Promise<Workstep | undefined> {
    const workstepModel = await this.prisma.workstep.findUnique({
      where: { id },
    });

    if (!workstepModel) {
      throw new NotFoundException(NOT_FOUND_ERR_MESSAGE);
    }

    return this.mapper.map(workstepModel, Workstep);
  }

  async getAllWorksteps(): Promise<Workstep[]> {
    const workstepModels = await this.prisma.workstep.findMany();
    return workstepModels.map((workstepModel) => {
      return this.mapper.map(workstepModel, Workstep);
    });
  }

  async getMatchingWorkstepsById(ids: string[]): Promise<Workstep[]> {
    const workstepModels = await this.prisma.workstep.findMany({
      where: {
        id: { in: ids },
      },
    });
    return workstepModels.map((w) => {
      return this.mapper.map(w, Workstep);
    });
  }

  async storeNewWorkstep(workstep: Workstep): Promise<Workstep> {
    const newWorkstepModel = await this.prisma.workstep.create({
      data: {
        name: workstep.name,
        version: workstep.version,
        status: workstep.status,
        workgroupId: workstep.workgroupId,
        securityPolicy: workstep.securityPolicy,
        privacyPolicy: workstep.privacyPolicy,
        circuitInputsTranslationSchema: workstep.circuitInputsTranslationSchema,
        workstepConfig: JSON.parse(JSON.stringify(workstep.workstepConfig)),
      },
    });
    return this.mapper.map(newWorkstepModel, Workstep);
  }

  async updateWorkstep(workstep: Workstep): Promise<Workstep> {
    const updatedWorkstepModel = await this.prisma.workstep.update({
      where: { id: workstep.id },
      data: {
        name: workstep.name,
        version: workstep.version,
        status: workstep.status,
        workgroupId: workstep.workgroupId,
        securityPolicy: workstep.securityPolicy,
        privacyPolicy: workstep.privacyPolicy,
        circuitInputsTranslationSchema: workstep.circuitInputsTranslationSchema,
        workstepConfig: JSON.parse(JSON.stringify(workstep.workstepConfig)),
      },
    });
    return this.mapper.map(updatedWorkstepModel, Workstep);
  }

  async deleteWorkstep(workstep: Workstep): Promise<void> {
    await this.prisma.workstep.delete({
      where: { id: workstep.id },
    });
  }
}
