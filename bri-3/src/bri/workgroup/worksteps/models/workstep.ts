import { AutoMap } from '@automapper/classes';

export enum WorkstepType {
  PAYLOAD_FROM_USER = 'PAYLOAD_FROM_USER',
  PAYLOAD_FROM_API = 'PAYLOAD_FROM_API',
  BPI_TRIGGER = 'BPI_TRIGGER',
  BPI_WAIT = 'BPI_WAIT',
}

export enum PayloadFormatType {
  JSON = 'JSON',
  XML = 'XML',
}

export class WorkstepExecutionParams {
  @AutoMap()
  verifierContractAddress?: string;

  @AutoMap()
  apiUrl?: string;
}

export class WorkstepConfig {
  @AutoMap()
  type: WorkstepType;

  @AutoMap()
  executionParams: WorkstepExecutionParams;

  @AutoMap()
  payloadFormatType: PayloadFormatType;
}

export class Workstep {
  @AutoMap()
  id: string; // TODO: Add uuid after #491

  @AutoMap()
  name: string;

  @AutoMap()
  version: string;

  @AutoMap()
  status: string;

  @AutoMap()
  workgroupId: string;

  @AutoMap()
  securityPolicy: string; // TODO Implement security policy inhereted from workgroup #487

  @AutoMap()
  privacyPolicy: string; // TODO Implement simple privacy policy inhereted from workgroup #487

  @AutoMap()
  circuitInputsTranslationSchema: string;

  @AutoMap()
  workstepConfig: WorkstepConfig;

  constructor(
    id: string,
    name: string,
    version: string,
    status: string,
    workgroupId: string,
    securityPolicy: string,
    privacyPolicy: string,
    workstepConfig: WorkstepConfig,
  ) {
    this.id = id;
    this.name = name;
    this.version = version;
    this.status = status;
    this.workgroupId = workgroupId;
    this.securityPolicy = securityPolicy;
    this.privacyPolicy = privacyPolicy;
    this.workstepConfig = workstepConfig;
  }

  public updateName(newName: string): void {
    this.name = newName;
  }

  public updateVersion(newVersion: string): void {
    this.version = newVersion;
  }

  public updateStatus(newStatus: string): void {
    this.status = newStatus;
  }

  public updateWorkgroupId(newWorkgroupId: string): void {
    this.workgroupId = newWorkgroupId;
  }

  public updateSecurityPolicy(newSecurityPolicy: string): void {
    this.securityPolicy = newSecurityPolicy;
  }

  public updatePrivacyPolicy(newPrivacyPolicy: string): void {
    this.privacyPolicy = newPrivacyPolicy;
  }

  public updateCircuitInputTranslationSchema(schema: string): void {
    this.circuitInputsTranslationSchema = schema;
  }

  public updateWorkstepConfig(newConfig: WorkstepConfig): void {
    this.workstepConfig = newConfig;
  }
}
