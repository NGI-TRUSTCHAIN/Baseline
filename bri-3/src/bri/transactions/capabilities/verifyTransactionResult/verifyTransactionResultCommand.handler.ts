import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TransactionAgent } from '../../agents/transactions.agent';
import { WorkflowStorageAgent } from '../../../workgroup/workflows/agents/workflowsStorage.agent';
import { WorkstepStorageAgent } from '../../../workgroup/worksteps/agents/workstepsStorage.agent';
import { VerifyTransactionResultCommand } from './verifyTransactionResult.command';
import { TransactionResult } from '../../models/transactionResult';
import { InjectMapper } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';

@CommandHandler(VerifyTransactionResultCommand)
export class VerifyTransactionResultCommandHandler
  implements ICommandHandler<VerifyTransactionResultCommand>
{
  constructor(
    @InjectMapper() private readonly mapper: Mapper,
    private txAgent: TransactionAgent,
    private workstepStorageAgent: WorkstepStorageAgent,
    private workflowStorageAgent: WorkflowStorageAgent,
  ) {}

  async execute(command: VerifyTransactionResultCommand) {
    try {
      const workstep = await this.workstepStorageAgent.getWorkstepById(
        command.workstepId,
      );

      if (!workstep) {
        throw new Error(`Workstep with ID ${command.workstepId} not found.`);
      }

      const workflow = await this.workflowStorageAgent.getWorkflowById(
        command.workflowId,
      );

      if (!workflow) {
        throw new Error(`Workflow with ID ${command.workflowId} not found.`);
      }
      let txResult = JSON.parse(command.transactionResult);
      txResult = {
        ...txResult,
        witness: JSON.parse(txResult.witness),
      };

      if (!txResult) {
        throw new Error('Invalid transaction result format.');
      }

      const verifiedTxResult = await this.txAgent.verifyTransactionResult(
        workflow.workgroup,
        workstep,
        txResult,
      );

      return verifiedTxResult.verifiedOnChain;
    } catch (error) {
      console.error('Error verifying transaction result:', error);
      return;
    }
  }
}
