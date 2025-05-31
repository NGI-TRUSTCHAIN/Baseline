import { JsonRpcProvider } from 'ethers';
import { ChainConfig } from '../models/chain.config';

export interface IChainProvider {
  getProvider(): JsonRpcProvider;
  getChainConfig(): ChainConfig;
}
