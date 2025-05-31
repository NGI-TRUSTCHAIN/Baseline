import { Injectable } from '@nestjs/common';
import { JsonRpcProvider } from 'ethers';
import { ChainConfig, ChainType } from '../models/chain.config';
import { IChainProvider } from './chain.provider.interface';

@Injectable()
export class ChainProviderFactory {
  private readonly chain: ChainType;
  private readonly chainConfig: ChainConfig;

  constructor() {
    const chain = process.env.CCSM_NETWORK as ChainType;
    if (!chain) {
      throw new Error('CCSM_NETWORK environment variable is required');
    }

    const upper = chain.toUpperCase();
    const rpcUrl = process.env[`${upper}_RPC_URL`];
    const ccsmContractAddress = process.env[`${upper}_CCSM_CONTRACT_ADDRESS`];

    if (!rpcUrl || !ccsmContractAddress) {
      throw new Error(`Missing environment variables for chain "${chain}"`);
    }

    this.chain = chain;
    this.chainConfig = {
      type: chain,
      rpcUrl,
      ccsmContractAddress,
    };
  }

  createProvider(): IChainProvider {
    const chain = this.chainConfig;

    return new (class implements IChainProvider {
      private readonly provider = new JsonRpcProvider(chain.rpcUrl);

      getProvider(): JsonRpcProvider {
        return this.provider;
      }

      getChainConfig(): ChainConfig {
        return chain;
      }
    })();
  }
}
