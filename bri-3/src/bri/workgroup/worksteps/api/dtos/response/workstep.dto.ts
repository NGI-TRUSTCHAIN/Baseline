import { AutoMap } from '@automapper/classes';
import { PayloadFormatType, WorkstepType } from '../../../models/workstep';

export class WorkstepExecutionParamsDto {
  @AutoMap()
  verifierContractAddress?: string;

  @AutoMap()
  apiUrl?: string;
}

export class WorkstepConfigDto {
  @AutoMap()
  type: WorkstepType;

  @AutoMap()
  executionParams: WorkstepExecutionParamsDto;

  @AutoMap()
  payloadFormatType: PayloadFormatType;
}
export class WorkstepDto {
  @AutoMap()
  id: string;

  @AutoMap()
  name: string;

  @AutoMap()
  version: string;

  @AutoMap()
  status: string;

  @AutoMap()
  workgroupId: string;

  @AutoMap()
  securityPolicy: string;

  @AutoMap()
  privacyPolicy: string;

  @AutoMap()
  circuitInputsTranslationSchema: string;

  @AutoMap()
  workstepConfig: WorkstepConfigDto;
}
