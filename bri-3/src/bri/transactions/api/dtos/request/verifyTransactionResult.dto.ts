import { IsNotEmpty } from 'class-validator';

export class VerifyTransactionResultDto {
  @IsNotEmpty()
  workflowId: string;

  @IsNotEmpty()
  workstepId: string;

  @IsNotEmpty()
  transactionResult: string;
}
