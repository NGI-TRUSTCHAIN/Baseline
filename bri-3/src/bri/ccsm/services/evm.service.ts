import { Injectable, InternalServerErrorException } from '@nestjs/common';
import 'dotenv/config';
import { BaseWallet, Contract, ethers, Provider, SigningKey } from 'ethers';
import * as CcsmBpiStateAnchor from '../../../../ccsm/artifacts/contracts/CcsmBpiStateAnchor.sol/CcsmBpiStateAnchor.json';
import { internalBpiSubjectEcdsaPrivateKey } from '../../../shared/testing/constants';
import { Witness } from '../../zeroKnowledgeProof/models/witness';
import { ICcsmService } from './ccsm.interface';
import * as fs from 'fs';
import { ChainProviderFactory } from './chain.provider.factory';
import { ChainConfig } from '../models/chain.config';
import { buildBn128, buildBls12381, utils } from 'ffjavascript';

const { unstringifyBigInts } = utils;
@Injectable()
export class EvmService implements ICcsmService {
  private provider: Provider;
  private wallet: BaseWallet;
  private chainConfig: ChainConfig;

  constructor(private readonly chainProviderFactory: ChainProviderFactory) {
    const chainProvider = this.chainProviderFactory.createProvider();
    this.provider = chainProvider.getProvider();
    this.chainConfig = chainProvider.getChainConfig();

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

    const { proofHexBytes, publicInputs } = await this.plonkProofFromWitness(
      witness.proof.value,
      witness.publicInputs,
    );

    try {
      return await verifierContract.verifyProof(proofHexBytes, publicInputs);
    } catch (error) {
      throw new InternalServerErrorException(
        `Error while trying to verify proof on chain : ${error}`,
      );
    }
  }

  private async connectToCcsmBpiStateAnchorContract(): Promise<Contract> {
    const ccsmBpiStateAnchorContract = new ethers.Contract(
      this.chainConfig.ccsmContractAddress,
      CcsmBpiStateAnchor.abi,
      this.wallet,
    );

    return ccsmBpiStateAnchorContract;
  }

  private formatHexString(value: string | number | bigint): string {
    let hexValue: string;
    if (typeof value === 'string' && value.startsWith('0x')) {
      // If it's already a hex string, just pad it
      hexValue = value;
    } else {
      // Otherwise, convert to BigInt first
      try {
        const bigIntValue = BigInt(value);
        hexValue = '0x' + bigIntValue.toString(16).padStart(64, '0');
      } catch (error) {
        throw new Error('Invalid value');
      }
    }
    return hexValue; // Remove '0x' prefix
  }

  private async getCurveFromName(name) {
    let curve;
    const normName = this.normalizeName(name);
    if (['BN128', 'BN254', 'ALTBN128'].indexOf(normName) >= 0) {
      curve = await buildBn128();
    } else if (['BLS12381'].indexOf(normName) >= 0) {
      curve = await buildBls12381();
    } else {
      throw new Error(`Curve not supported: ${name}`);
    }
    return curve;
  }

  private normalizeName(n) {
    return n
      .toUpperCase()
      .match(/[A-Za-z0-9]+/g)
      .join('');
  }

  private async plonkProofFromWitness(witnessProof, witnessPub) {
    const proof = unstringifyBigInts(witnessProof);
    const pub = unstringifyBigInts(witnessPub);

    const curve = await this.getCurveFromName(proof.curve);
    const G1 = curve.G1;
    const Fr = curve.Fr;

    const inputs = pub.map((p) => {
      return this.formatHexString(p);
    });

    const proofBuff = new Uint8Array(G1.F.n8 * 2 * 9 + Fr.n8 * 7);
    G1.toRprUncompressed(proofBuff, 0, G1.e(proof.A));
    G1.toRprUncompressed(proofBuff, G1.F.n8 * 2, G1.e(proof.B));
    G1.toRprUncompressed(proofBuff, G1.F.n8 * 4, G1.e(proof.C));
    G1.toRprUncompressed(proofBuff, G1.F.n8 * 6, G1.e(proof.Z));
    G1.toRprUncompressed(proofBuff, G1.F.n8 * 8, G1.e(proof.T1));
    G1.toRprUncompressed(proofBuff, G1.F.n8 * 10, G1.e(proof.T2));
    G1.toRprUncompressed(proofBuff, G1.F.n8 * 12, G1.e(proof.T3));
    G1.toRprUncompressed(proofBuff, G1.F.n8 * 14, G1.e(proof.Wxi));
    G1.toRprUncompressed(proofBuff, G1.F.n8 * 16, G1.e(proof.Wxiw));
    Fr.toRprBE(proofBuff, G1.F.n8 * 18, Fr.e(proof.eval_a));
    Fr.toRprBE(proofBuff, G1.F.n8 * 18 + Fr.n8, Fr.e(proof.eval_b));
    Fr.toRprBE(proofBuff, G1.F.n8 * 18 + Fr.n8 * 2, Fr.e(proof.eval_c));
    Fr.toRprBE(proofBuff, G1.F.n8 * 18 + Fr.n8 * 3, Fr.e(proof.eval_s1));
    Fr.toRprBE(proofBuff, G1.F.n8 * 18 + Fr.n8 * 4, Fr.e(proof.eval_s2));
    Fr.toRprBE(proofBuff, G1.F.n8 * 18 + Fr.n8 * 5, Fr.e(proof.eval_zw));
    Fr.toRprBE(proofBuff, G1.F.n8 * 18 + Fr.n8 * 6, Fr.e(proof.eval_r));

    const proofHex = Array.from(proofBuff).map(this.i2hex).join('');

    return {
      proofHexBytes: '0x' + proofHex,
      publicInputs: inputs,
    };
  }

  private i2hex(i) {
    return ('0' + i.toString(16)).slice(-2);
  }
}
