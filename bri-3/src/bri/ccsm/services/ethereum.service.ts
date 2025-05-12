import { Injectable, InternalServerErrorException } from '@nestjs/common';
import 'dotenv/config';
import {
  BaseWallet,
  Contract,
  ethers,
  InfuraProvider,
  JsonRpcProvider,
  Provider,
  SigningKey,
} from 'ethers';
import * as CcsmBpiStateAnchor from '../../../../ccsmArtifacts/contracts/CcsmBpiStateAnchor.sol/CcsmBpiStateAnchor.json';
import { internalBpiSubjectEcdsaPrivateKey } from '../../../shared/testing/constants';
import { Witness } from '../../zeroKnowledgeProof/models/witness';
import { ICcsmService } from './ccsm.interface';
import * as fs from 'fs';

@Injectable()
export class EthereumService implements ICcsmService {
  private provider: Provider;
  private wallet: BaseWallet;

  constructor() {
    const network = process.env.CCSM_NETWORK;

    if (network === 'localhost') {
      this.provider = new JsonRpcProvider('http://127.0.0.1:8545');
    } else {
      this.provider = new InfuraProvider(
        network,
        process.env.INFURA_PROVIDER_API_KEY,
      );
    }

    const signingKey = new SigningKey(internalBpiSubjectEcdsaPrivateKey);
    this.wallet = new BaseWallet(signingKey, this.provider);
  }

  public async storeAnchorHash(
    workstepInstanceId: string,
    anchorHash: string,
  ): Promise<void> {
    const ccsmContract = await this.connectToCcsmBpiStateAnchorContract();
    try {
      const tx = await ccsmContract.setAnchorHash(
        workstepInstanceId,
        anchorHash,
      );
      await tx.wait();
    } catch (error) {
      throw new InternalServerErrorException(
        `Error while trying to store anchor hash on chain : ${error}`,
      );
    }
  }

  public async getAnchorHash(workstepInstanceId: string): Promise<string> {
    const ccsmContract = await this.connectToCcsmBpiStateAnchorContract();
    const anchorHash = await ccsmContract.getAnchorHash(workstepInstanceId);
    return anchorHash;
  }

  public async verifyProof(
    verifierAddress: string,
    pathToAbi: string,
    witness: Witness,
  ): Promise<boolean> {
    let verifierAbi = '';
    try {
      const abiRaw = fs.readFileSync(pathToAbi, 'utf8');
      verifierAbi = JSON.parse(abiRaw);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(
          'Workstep verifier contract ABI does not exist on path:' + pathToAbi,
        );
      } else {
        throw new Error('Error while reading verifier contract ABI:' + error);
      }
    }

    const verifierContract = new ethers.Contract(
      verifierAddress,
      verifierAbi['abi'],
      this.wallet,
    );

    const proofElements = [
      ...witness.proof.value['A'].slice(0, 2),
      ...witness.proof.value['B'].slice(0, 2),
      ...witness.proof.value['C'].slice(0, 2),
      ...witness.proof.value['Z'].slice(0, 2),
      ...witness.proof.value['T1'].slice(0, 2),
      ...witness.proof.value['T2'].slice(0, 2),
      ...witness.proof.value['T3'].slice(0, 2),
      ...witness.proof.value['Wxi'].slice(0, 2),
      ...witness.proof.value['Wxiw'].slice(0, 2),
      witness.proof.value['eval_a'],
      witness.proof.value['eval_b'],
      witness.proof.value['eval_c'],
      witness.proof.value['eval_s1'],
      witness.proof.value['eval_s2'],
      witness.proof.value['eval_zw'],
      witness.proof.value['eval_r'],
    ];

    console.log('Raw proof elements:', proofElements);
    console.log(
      'Proof elements types:',
      proofElements.map((el) => typeof el),
    );
    console.log(
      'Proof elements values:',
      proofElements.map((el) => (el === undefined ? 'undefined' : el)),
    );

    const proofHex =
      '0x' +
      proofElements
        .map((element, index) => {
          console.log(`Converting element ${index}:`, element);
          try {
            const result = this.formatHexString(element);
            console.log(`Successfully converted element ${index} to:`, result);
            return result;
          } catch (error) {
            console.error(`Failed to convert element ${index}:`, error);
            throw error;
          }
        })
        .join('');

    console.log('Final proofHex:', proofHex);

    const pubInputs = witness.publicInputs!.map((input) => BigInt(input));

    try {
      return await verifierContract.verifyProof(proofHex, pubInputs);
    } catch (error) {
      throw new InternalServerErrorException(
        `Error while trying to verify proof on chain : ${error}`,
      );
    }
  }

  private async connectToCcsmBpiStateAnchorContract(): Promise<Contract> {
    const ccsmContractAddress =
      process.env.CCSM_BPI_STATE_ANCHOR_CONTRACT_ADDRESS!;

    const ccsmBpiStateAnchorContract = new ethers.Contract(
      ccsmContractAddress,
      CcsmBpiStateAnchor.abi,
      this.wallet,
    );

    return ccsmBpiStateAnchorContract;
  }

  private formatHexString(value: string | number | bigint): string {
    console.log('formatHexString input:', value, 'type:', typeof value);
    let hexValue: string;
    if (typeof value === 'string' && value.startsWith('0x')) {
      // If it's already a hex string, just pad it
      hexValue = value;
      console.log('Input was hex string:', hexValue);
    } else {
      // Otherwise, convert to BigInt first
      try {
        console.log('Attempting to convert to BigInt:', value);
        const bigIntValue = BigInt(value);
        hexValue = '0x' + bigIntValue.toString(16).padStart(64, '0');
        console.log('Successfully converted to hex:', hexValue);
      } catch (error) {
        console.error('Error converting value to BigInt:', value);
        console.error('Error details:', error);
        throw error;
      }
    }
    const result = hexValue.slice(2); // Remove '0x' prefix
    console.log('Final formatted hex:', result);
    return result;
  }
}
