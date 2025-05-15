import { AutomapperProfile, InjectMapper } from '@automapper/nestjs';
import { createMap, Mapper } from '@automapper/core';
import { Injectable } from '@nestjs/common';
import {
  Workstep,
  WorkstepConfig,
  WorkstepExecutionParams,
} from './models/workstep';
import {
  WorkstepConfigDto,
  WorkstepExecutionParamsDto,
  WorkstepDto,
} from './api/dtos/response/workstep.dto';

@Injectable()
export class WorkstepProfile extends AutomapperProfile {
  constructor(@InjectMapper() mapper: Mapper) {
    super(mapper);
  }

  override get profile() {
    return (mapper) => {
      createMap(mapper, Workstep, WorkstepDto);
      createMap(mapper, WorkstepExecutionParams, WorkstepExecutionParamsDto);
      createMap(mapper, WorkstepConfig, WorkstepConfigDto);
    };
  }
}
