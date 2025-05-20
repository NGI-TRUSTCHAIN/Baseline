import { IsNotEmpty } from 'class-validator';
import { WorkstepConfig } from '../../../models/workstep';

export class CreateWorkstepDto {
  @IsNotEmpty()
  name: string;

  version: string;

  status: string;

  @IsNotEmpty()
  workgroupId: string;

  securityPolicy: string;

  privacyPolicy: string;

  @IsNotEmpty()
  workstepConfig: WorkstepConfig;
}
