import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

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
