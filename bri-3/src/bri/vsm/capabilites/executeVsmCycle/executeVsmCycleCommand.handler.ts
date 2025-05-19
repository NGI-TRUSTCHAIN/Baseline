import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { StateAgent } from '../../../state/agents/state.agent';
import { TransactionStorageAgent } from '../../../transactions/agents/transactionStorage.agent';
import { TransactionAgent } from '../../../transactions/agents/transactions.agent';
import { TransactionStatus } from '../../../transactions/models/transactionStatus.enum';
import { WorkflowStorageAgent } from '../../../workgroup/workflows/agents/workflowsStorage.agent';
import { WorkstepStorageAgent } from '../../../workgroup/worksteps/agents/workstepsStorage.agent';
import { ExecuteVsmCycleCommand } from './executeVsmCycle.command';
import { WorkstepExecutedEvent } from '../handleWorkstepEvents/workstepExecuted.event';
import { CcsmStorageAgent } from '../../../ccsm/agents/ccsmStorage.agent';
import { LoggingService } from '../../../../shared/logging/logging.service';

@CommandHandler(ExecuteVsmCycleCommand)
export class ExecuteVsmCycleCommandHandler
  implements ICommandHandler<ExecuteVsmCycleCommand>
{
  constructor(
    private txAgent: TransactionAgent,
    private stateAgent: StateAgent,
    private workstepStorageAgent: WorkstepStorageAgent,
    private workflowStorageAgent: WorkflowStorageAgent,
    private txStorageAgent: TransactionStorageAgent,
    private ccsmStorageAgent: CcsmStorageAgent,
    private eventBus: EventBus,
    private readonly logger: LoggingService,
  ) {}

  async execute(command: ExecuteVsmCycleCommand) {
    const executionCandidates =
      await this.txStorageAgent.getTopNTransactionsByStatus(
        Number(process.env.VSM_CYCLE_TX_BATCH_SIZE),
        TransactionStatus.Initialized,
      );

    // TODO: When do we update the nonce on the BpiAccount? // Whenever a transaction is initiated
    executionCandidates.forEach(async (tx) => {
      tx.updateStatusToProcessing();
      await this.txStorageAgent.updateTransaction(tx);

      if (!this.txAgent.validateTransactionForExecution(tx)) {
        this.eventBus.publish(
          new WorkstepExecutedEvent(tx, 'Validation Error'),
        );
        tx.updateStatusToInvalid();
        await this.txStorageAgent.updateTransaction(tx);
        return;
      }

      const workstep = await this.workstepStorageAgent.getWorkstepById(
        tx.workstepId,
      );

      const workflow = await this.workflowStorageAgent.getWorkflowById(
        tx.workflowId,
      );

      try {
        this.logger.logInfo('TEST: process start');
        const txResult = await this.txAgent.executeTransaction(tx, workstep!);

        this.logger.logInfo(`TEST: process 2 ${JSON.stringify(txResult)}`);

        const stateTreeRoot = await this.stateAgent.storeNewLeafInStateTree(
          workflow!.bpiAccount,
          txResult.hash,
          txResult.merkelizedPayload,
          txResult.witness,
        );
        this.logger.logInfo('TEST: process 3');

        await this.stateAgent.storeNewLeafInHistoryTree(
          workflow!.bpiAccount,
          stateTreeRoot,
        );

        this.logger.logInfo('TEST: process 4');

        await this.ccsmStorageAgent.storeAnchorHashOnCcsm(
          tx.workstepInstanceId,
          txResult.hash,
        );

        this.logger.logInfo('TEST: process 5');

        tx.updateStatusToExecuted();

        this.logger.logInfo('TEST: process 6');

        this.txStorageAgent.updateTransaction(tx);
        this.logger.logInfo('TEST: process 7');
      } catch (error) {
        this.eventBus.publish(new WorkstepExecutedEvent(tx, error));
        tx.updateStatusToAborted();
        this.txStorageAgent.updateTransaction(tx);
        return;
      }

      await this.eventBus.publish(new WorkstepExecutedEvent(tx, 'Success'));
    });
  }
}
