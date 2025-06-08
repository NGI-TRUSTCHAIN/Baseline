import { HardhatUserConfig, subtask } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const {
  TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD,
} = require('hardhat/builtin-tasks/task-names');
const path = require('path');

subtask(
  TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD,
  async (args: { solcVersion: string }, hre, runSuper) => {
    if (args.solcVersion === '0.8.28') {
      return {
        compilerPath: '/usr/bin/solc', // point to native solc binary here
        isSolcJs: false, // must be false for native solc
        version: args.solcVersion,
        longVersion: '0.8.28+commit.7893614a.Linux.g++',
      };
    }

    return runSuper();
  },
);

const config: HardhatUserConfig = {
  solidity: '0.8.28',
  defaultNetwork: 'localhost',
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      blockGasLimit: 90000000,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      allowUnlimitedContractSize: true,
    },
    sepolia: {
      url:
        'https://sepolia.infura.io/v3/' + process.env.INFURA_PROVIDER_API_KEY,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [], // TODO: Add test account for sepolia
    },
  },
  paths: {
    artifacts: '../ccsmArtifacts',
  },
};

export default config;
