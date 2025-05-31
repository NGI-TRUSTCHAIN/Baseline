import { Module } from '@nestjs/common';
import { CcsmStorageAgent } from './agents/ccsmStorage.agent';
import { EvmService } from './services/evm.service';
import { ChainProviderFactory } from './services/chain.provider.factory';

@Module({
  providers: [
    CcsmStorageAgent,
    ChainProviderFactory,
    {
      provide: 'ICcsmService',
      useClass: EvmService,
    },
  ],
  exports: [CcsmStorageAgent, 'ICcsmService'],
})
export class CcsmModule {}
