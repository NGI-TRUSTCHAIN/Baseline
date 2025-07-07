import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseStringPromise, processors } from 'xml2js';
import { Transaction } from '../models/transaction';
import { TransactionStatus } from '../models/transactionStatus.enum';

import MerkleTree from 'merkletreejs';
import { Witness } from 'src/bri/zeroKnowledgeProof/models/witness';
import { LoggingService } from '../../../shared/logging/logging.service';
import { AuthAgent } from '../../auth/agent/auth.agent';
import { ICcsmService } from '../../ccsm/services/ccsm.interface';
import { BpiSubjectAccount } from '../../identity/bpiSubjectAccounts/models/bpiSubjectAccount';
import { PublicKeyType } from '../../identity/bpiSubjects/models/publicKey';
import { MerkleTreeService } from '../../merkleTree/services/merkleTree.service';
import { WorkflowStorageAgent } from '../../workgroup/workflows/agents/workflowsStorage.agent';
import { Workgroup } from '../../workgroup/workgroups/models/workgroup';
import { WorkstepStorageAgent } from '../../workgroup/worksteps/agents/workstepsStorage.agent';
import {
  PayloadFormatType,
  Workstep,
  WorkstepType,
} from '../../workgroup/worksteps/models/workstep';
import { CircuitInputsParserService } from '../../zeroKnowledgeProof/services/circuit/circuitInputsParser/circuitInputParser.service';
import { ICircuitService } from '../../zeroKnowledgeProof/services/circuit/circuitService.interface';
import { computeEddsaSigPublicInputs } from '../../zeroKnowledgeProof/services/circuit/snarkjs/utils/computePublicInputs';
import {
  DELETE_WRONG_STATUS_ERR_MESSAGE,
  NOT_FOUND_ERR_MESSAGE,
  UPDATE_WRONG_STATUS_ERR_MESSAGE,
} from '../api/err.messages';
import { TransactionResult } from '../models/transactionResult';
import { TransactionStorageAgent } from './transactionStorage.agent';
import { IMessagingClient } from '../../communication/messagingClients/messagingClient.interface';

@Injectable()
export class TransactionAgent {
  constructor(
    private txStorageAgent: TransactionStorageAgent,
    private workstepStorageAgent: WorkstepStorageAgent,
    private workflowStorageAgent: WorkflowStorageAgent,
    private authAgent: AuthAgent,
    private merkleTreeService: MerkleTreeService,
    @Inject('ICircuitService')
    private readonly circuitService: ICircuitService,
    private circuitInputsParserService: CircuitInputsParserService,
    @Inject('ICcsmService')
    private readonly ccsmService: ICcsmService,
    private readonly logger: LoggingService,
    @Inject('IMessagingClient')
    private readonly natsMessagingClient: IMessagingClient,
  ) {}

  public throwIfCreateTransactionInputInvalid() {
    // TODO: This is a placeholder, we will add validation rules as we move forward with business logic implementation
    return true;
  }

  public isCreateTransactionInputInvalid(): boolean {
    // TODO: This is a placeholder, we will add validation rules as we move forward with business logic implementation
    return false;
  }

  public createNewTransaction(
    id: string,
    nonce: number,
    workflowId: string,
    workstepId: string,
    fromBpiSubjectAccount: BpiSubjectAccount,
    toBpiSubjectAccount: BpiSubjectAccount,
    payload: string,
    signature: string,
  ): Transaction {
    return new Transaction(
      id,
      nonce,
      workflowId,
      workstepId,
      fromBpiSubjectAccount,
      toBpiSubjectAccount,
      payload,
      signature,
      TransactionStatus.Initialized,
    );
  }

  public async fetchUpdateCandidateAndThrowIfUpdateValidationFails(
    id: string,
  ): Promise<Transaction> {
    const transactionToUpdate =
      await this.txStorageAgent.getTransactionById(id);

    if (!transactionToUpdate) {
      throw new NotFoundException(NOT_FOUND_ERR_MESSAGE);
    }

    if (transactionToUpdate.status !== TransactionStatus.Initialized) {
      throw new BadRequestException(UPDATE_WRONG_STATUS_ERR_MESSAGE);
    }

    return transactionToUpdate;
  }

  public updateTransaction(
    transactionToUpdate: Transaction,
    payload: string,
    signature: string,
  ) {
    transactionToUpdate.updatePayload(payload, signature);
  }

  public updateTransactionStatusToProcessing(
    transactionsToUpdate: Transaction,
  ) {
    transactionsToUpdate.updateStatusToProcessing();
  }

  public async fetchDeleteCandidateAndThrowIfDeleteValidationFails(
    id: string,
  ): Promise<Transaction> {
    const transactionToDelete =
      await this.txStorageAgent.getTransactionById(id);

    if (!transactionToDelete) {
      throw new NotFoundException(NOT_FOUND_ERR_MESSAGE);
    }

    if (
      transactionToDelete.status === TransactionStatus.Processing ||
      transactionToDelete.status === TransactionStatus.Executed
    ) {
      throw new BadRequestException(DELETE_WRONG_STATUS_ERR_MESSAGE);
    }

    return transactionToDelete;
  }

  public async validateTransactionForExecution(
    tx: Transaction,
  ): Promise<boolean> {
    // TODO: Log each validation err for now
    const workflow = await this.workflowStorageAgent.getWorkflowById(
      tx.workflowId,
    );

    if (!workflow) {
      return false;
    }

    const workstep = await this.workstepStorageAgent.getWorkstepById(
      tx.workstepId,
    );

    if (!workstep) {
      return false;
    }

    if (!tx.fromBpiSubjectAccount) {
      return false;
    }

    if (!tx.toBpiSubjectAccount) {
      return false;
    }

    if (tx.nonce !== workflow.bpiAccount.nonce + 1) {
      return false;
    }

    const isSignatureValid =
      await this.authAgent.verifyEddsaSignatureAgainstPublicKey(
        tx.payload,
        tx.signature,
        tx.fromBpiSubjectAccount.ownerBpiSubject.publicKeys.filter(
          (key) => key.type == PublicKeyType.EDDSA,
        )[0].value,
      );

    if (!isSignatureValid) {
      return false;
    }

    if (tx.status !== TransactionStatus.Processing) {
      return false;
    }

    return true;
  }

  public async executeTransaction(
    tx: Transaction,
    workgroup: Workgroup,
    workstep: Workstep,
  ): Promise<TransactionResult> {
    const txResult = new TransactionResult();

    // For now defaulting to JSON in case undefined for backward compatibility
    const payloadFormatType =
      workstep.workstepConfig.payloadFormatType || PayloadFormatType.JSON;

    if (workstep.workstepConfig.payloadFormatType === PayloadFormatType.XML) {
      const xmlPayload = await this.circuitInputsParserService.parseXMLToFlat(
        tx.payload,
      );
      txResult.merkelizedPayload = this.merkleTreeService.merkelizePayload(
        xmlPayload,
        `${process.env.MERKLE_TREE_HASH_ALGH}`,
      );
    } else {
      txResult.merkelizedPayload = this.merkleTreeService.merkelizePayload(
        JSON.parse(tx.payload),
        `${process.env.MERKLE_TREE_HASH_ALGH}`,
      );
    }

    switch (workstep.workstepConfig.type) {
      case WorkstepType.BPI_WAIT:
        this.logger.logInfo(
          `called from another bpi with payload ${tx.payload}`,
        );
        tx.payload = {} as any; // TODO
        break;
      case WorkstepType.BPI_TRIGGER:
        this.logger.logInfo(`triggering bpi with payload ${tx.payload}`);
        const parsedPayload = JSON.parse(tx.payload);
        this.natsMessagingClient.publish('general', tx.payload);
        tx.payload = {} as any; // TODO
        break;
      case WorkstepType.PAYLOAD_FROM_USER:
        this.logger.logInfo('Triggering tx execution with user input payload');
        //TODO: Add formatting or verification for tx.payload
        break;

      case WorkstepType.PAYLOAD_FROM_API:
        this.logger.logInfo('CALLING API WORKSTEP');
        const response = await this.executeApiCall(
          workstep.workstepConfig.executionParams.apiUrl!,
          JSON.parse(tx.payload),
        );
        this.logger.logInfo(`RESPONSE: ${JSON.stringify(response.data)}`);
        const parsed = await parseStringPromise(response.data, {
          explicitArray: false,
          tagNameProcessors: [processors.stripPrefix],
        });

        tx.payload = JSON.stringify(parsed);
        break;

      default:
        throw new Error(
          `Unsupported workstep type: ${workstep.workstepConfig.type}`,
        );
    }

    const {
      circuitProvingKeyPath,
      circuitVerificatioKeyPath,
      circuitPath,
      circuitWitnessCalculatorPath,
      circuitWitnessFilePath,
      verifierContractAbiFilePath,
    } = this.constructCircuitPathsFromWorkgroupAndWorkstepName(
      workgroup.name,
      workstep.name,
    );

    txResult.witness = await this.circuitService.createWitness(
      await this.prepareCircuitInputs(
        tx,
        workstep.circuitInputsTranslationSchema,
        payloadFormatType,
      ),
      circuitPath,
      circuitProvingKeyPath,
      circuitVerificatioKeyPath,
      circuitWitnessCalculatorPath,
      circuitWitnessFilePath,
    );

    txResult.verifiedOnChain = await this.ccsmService.verifyProof(
      workstep.workstepConfig.executionParams.verifierContractAddress!,
      verifierContractAbiFilePath,
      txResult.witness,
    );

    txResult.hash = this.constructTxHash(
      txResult.merkelizedPayload,
      txResult.witness,
    );

    return txResult;
  }

  private constructCircuitPathsFromWorkgroupAndWorkstepName(
    workgroupName: string,
    workstepName: string,
  ): {
    circuitProvingKeyPath: string;
    circuitVerificatioKeyPath: string;
    circuitPath: string;
    circuitWitnessCalculatorPath: string;
    circuitWitnessFilePath: string;
    verifierContractAbiFilePath: string;
  } {
    const snakeCaseWorkstepName = this.convertStringToSnakeCase(workstepName);

    const workstepZKArtifactsFolder =
      process.env.SNARKJS_CIRCUITS_PATH +
      workgroupName +
      'Workgroup' +
      '/' +
      snakeCaseWorkstepName +
      '/';

    const circuitProvingKeyPath =
      workstepZKArtifactsFolder + snakeCaseWorkstepName + '_final.zkey';

    const circuitVerificatioKeyPath =
      workstepZKArtifactsFolder +
      snakeCaseWorkstepName +
      '_verification_key.json';

    const circuitPath =
      workstepZKArtifactsFolder +
      snakeCaseWorkstepName +
      '_js/' +
      snakeCaseWorkstepName +
      '.wasm';

    const circuitWitnessCalculatorPath =
      '../../../../../../' +
      workstepZKArtifactsFolder +
      snakeCaseWorkstepName +
      '_js/witness_calculator.js';

    const circuitWitnessFilePath = workstepZKArtifactsFolder + '/witness.txt';

    const verifierContractAbiFilePath =
      workstepZKArtifactsFolder +
      snakeCaseWorkstepName +
      'Verifier.sol' +
      '/' +
      snakeCaseWorkstepName +
      'Verifier.json';
    return {
      circuitProvingKeyPath,
      circuitVerificatioKeyPath,
      circuitPath,
      circuitWitnessCalculatorPath,
      circuitWitnessFilePath,
      verifierContractAbiFilePath,
    };
  }

  private convertStringToSnakeCase(name: string): string {
    name = name.trim();

    // Replace spaces, hyphens, and underscores with a single underscore
    name = name.replace(/[\s-]/g, '_');

    // Convert uppercase letters to lowercase and insert an underscore before them if they are not at the beginning
    name = name.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`);

    // Remove any consecutive underscores
    name = name.replace(/_+/g, '_');

    // Remove any non-alphanumeric characters except for underscore
    name = name.replace(/[^a-zA-Z0-9_]/g, '');

    return name;
  }

  private async prepareCircuitInputs(
    tx: Transaction,
    circuitInputsTranslationSchema: string,
    payloadFormatType: PayloadFormatType,
  ): Promise<object> {
    const payloadAsCircuitInputs = await this.preparePayloadAsCircuitInputs(
      tx.payload,
      circuitInputsTranslationSchema,
      payloadFormatType,
    );

    return Object.assign(
      payloadAsCircuitInputs,
      await computeEddsaSigPublicInputs(tx),
    );
  }

  private async preparePayloadAsCircuitInputs(
    txPayload: string,
    workstepTranslationSchema: string,
    payloadFormatType: PayloadFormatType,
  ): Promise<object> {
    const mapping: CircuitInputsMapping = JSON.parse(workstepTranslationSchema);

    if (!mapping) {
      throw new Error(`Broken mapping`);
    }

    const parsedInputs =
      await this.circuitInputsParserService.applyMappingToTxPayload(
        txPayload,
        payloadFormatType,
        mapping,
      );

    if (!parsedInputs) {
      throw new Error(`Failed to parse inputs`);
    }

    return parsedInputs;
  }

  private constructTxHash(
    merkelizedPayload: MerkleTree,
    witness: Witness,
  ): string {
    const hashFn = this.merkleTreeService.createHashFunction(
      `${process.env.MERKLE_TREE_HASH_ALGH}`,
    );

    const merkelizedInvoiceRoot = merkelizedPayload.getRoot().toString('hex');
    const witnessHash = hashFn(JSON.stringify(witness)).toString('hex');

    return hashFn(`${merkelizedInvoiceRoot}${witnessHash}`).toString('hex');
  }

  private async executeApiCall(url: string, payload: any): Promise<any> {
    this.logger.logInfo(`TX PAYLOAD ${JSON.stringify(payload)}`);
    try {
      // Construct URL with query parameters if they exist
      let fullUrl = url;
      if (payload.queryParams) {
        const queryString = new URLSearchParams(payload.queryParams).toString();
        fullUrl = `${url}?${queryString}`;
      }
      this.logger.logInfo(`FULL URL ${fullUrl}`);

      const response = await fetch(fullUrl, {
        method: payload.method || 'GET',
        headers: {
          'Content-Type': payload.contentType || 'application/json',
          ApiKey: payload.apiKey,
          ...payload.headers,
        },
        body: payload.body ? JSON.stringify(payload.body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`API call failed with status ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/xml')) {
        const xmlText = await response.text();
        return {
          contentType: 'application/xml',
          data: xmlText,
          headers: Object.fromEntries(response.headers.entries()),
        };
      } else {
        return {
          contentType: contentType || 'application/json',
          data: await response.json(),
          headers: Object.fromEntries(response.headers.entries()),
        };
      }
    } catch (error) {
      throw new Error(`Failed to execute API call: ${error.message}`);
    }
  }
}
