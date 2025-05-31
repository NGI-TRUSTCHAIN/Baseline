export type ChainType = 'localhost' | 'sepolia' | 'polygon' | string;

export interface ChainConfig {
  type: ChainType;
  rpcUrl: string;
  ccsmContractAddress: string;
}
