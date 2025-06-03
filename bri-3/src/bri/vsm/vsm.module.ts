import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggingModule } from '../../shared/logging/logging.module';
import { StateModule } from '../state/state.module';
import { TransactionModule } from '../transactions/transactions.module';
import { WorkflowModule } from '../workgroup/workflows/workflows.module';
import { WorkstepModule } from '../workgroup/worksteps/worksteps.module';
import { VsmTasksSchedulerAgent } from './agents/vsmTaskScheduler.agent';
import { ExecuteVsmCycleCommandHandler } from './capabilites/executeVsmCycle/executeVsmCycleCommand.handler';
import { WorkstepExecutedEventHandler } from './capabilites/handleWorkstepEvents/workstepExecutedEvent.handler';
import { NatsMessagingClient } from '../communication/messagingClients/natsMessagingClient';
import { CcsmStorageAgent } from '../ccsm/agents/ccsmStorage.agent';
import { EvmService } from '../ccsm/services/evm.service';
import { ChainProviderFactory } from '../ccsm/services/chain.provider.factory';
import { CommunicationModule } from '../communication/communication.module';

export const CommandHandlers = [
  ExecuteVsmCycleCommandHandler,
  WorkstepExecutedEventHandler,
];

export const QueryHandlers = [];

@Module({
  imports: [
    CqrsModule,
    ScheduleModule.forRoot(),
    TransactionModule,
    LoggingModule,
    WorkstepModule,
    WorkflowModule,
    StateModule,
    CommunicationModule,
  ],
  providers: [
    VsmTasksSchedulerAgent,
    ...CommandHandlers,
    ...QueryHandlers,
    CcsmStorageAgent,
    ChainProviderFactory,
    {
      provide: 'IMessagingClient',
      useClass: NatsMessagingClient,
    },
    {
      provide: 'ICcsmService',
      useClass: EvmService,
    },
  ],
})
export class VsmModule {}
