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
import { GeneralCircuitInputsParserService } from '../../zeroKnowledgeProof/services/circuit/circuitInputsParser/generalCircuitInputParser.service';
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
    private circuitInputsParserService: GeneralCircuitInputsParserService,
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
        txResult.witness = {} as any; // TODO
        break;
      case WorkstepType.BPI_TRIGGER:
        this.logger.logInfo(`triggering bpi with payload ${tx.payload}`);
        const parsedPayload = JSON.parse(tx.payload);
        this.natsMessagingClient.publish('general', tx.payload);
        txResult.witness = {} as any; // TODO
        break;
      case WorkstepType.BLOCKCHAIN:
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
        break;

      case WorkstepType.API:
        this.logger.logInfo('CALLING API WORKSTEP');
        const response = await this.executeApiCall(
          workstep.workstepConfig.executionParams.apiUrl!,
          JSON.parse(tx.payload),
        );
        this.logger.logInfo(`RESPONSE: ${JSON.stringify(response)}`);
        const parsed = await parseStringPromise(response.data, {
          explicitArray: false,
          tagNameProcessors: [processors.stripPrefix],
        });

        const envelope = parsed.DocumentEnvelope;
        const header = envelope.DocumentHeader;
        const body = envelope.DocumentBody;
        const invoice = body.Invoice;

        this.logger.logInfo('DOCUMENT HEADER');
        this.logger.logInfo(`SalesInvoiceId: ${header.SalesInvoiceId}`);
        this.logger.logInfo(`PurchaseInvoiceId: ${header.PurchaseInvoiceId}`);
        this.logger.logInfo(`DocumentId: ${header.DocumentId}`);
        this.logger.logInfo(`CreationDate: ${header.CreationDate}`);
        this.logger.logInfo(`SendingDate: ${header.SendingDate}`);

        this.logger.logInfo('\nINVOICE');
        this.logger.logInfo(`ID: ${invoice.ID}`);
        this.logger.logInfo(`IssueDate: ${invoice.IssueDate}`);
        this.logger.logInfo(`DueDate: ${invoice.DueDate}`);
        this.logger.logInfo(`TypeCode: ${invoice.InvoiceTypeCode}`);
        this.logger.logInfo(`Currency: ${invoice.DocumentCurrencyCode}`);

        const supplier = invoice.AccountingSupplierParty.Party;
        const customer = invoice.AccountingCustomerParty.Party;

        this.logger.logInfo('\nSUPPLIER');
        this.logger.logInfo(`Name: ${supplier.PartyName?.Name}`);
        this.logger.logInfo(`EndpointID: ${supplier.EndpointID?._}`);
        this.logger.logInfo(`Street: ${supplier.PostalAddress?.StreetName}`);
        this.logger.logInfo(`City: ${supplier.PostalAddress?.CityName}`);
        this.logger.logInfo(
          `Country: ${supplier.PostalAddress?.Country?.IdentificationCode}`,
        );

        this.logger.logInfo('\nCUSTOMER');
        this.logger.logInfo(`Name: ${customer.PartyName?.Name}`);
        this.logger.logInfo(`EndpointID: ${customer.EndpointID?._}`);
        this.logger.logInfo(`Street: ${customer.PostalAddress?.StreetName}`);
        this.logger.logInfo(`City: ${customer.PostalAddress?.CityName}`);
        this.logger.logInfo(
          `PostalZone: ${customer.PostalAddress?.PostalZone}`,
        );
        this.logger.logInfo(
          `Country: ${customer.PostalAddress?.Country?.IdentificationCode}`,
        );

        this.logger.logInfo('\nTOTALS');
        const totals = invoice.LegalMonetaryTotal;
        this.logger.logInfo(
          `LineExtensionAmount: ${JSON.stringify(totals.LineExtensionAmount)}`,
        );
        this.logger.logInfo(
          `TaxExclusiveAmount: ${JSON.stringify(totals.TaxExclusiveAmount)}`,
        );
        this.logger.logInfo(
          `TaxInclusiveAmount: ${JSON.stringify(totals.TaxInclusiveAmount)}`,
        );
        this.logger.logInfo(
          `PayableAmount: ${JSON.stringify(totals.PayableAmount)}`,
        );

        this.logger.logInfo('\nTAX');
        const tax = invoice.TaxTotal;
        this.logger.logInfo(`TaxAmount: ${JSON.stringify(tax.TaxAmount)}`);
        const taxCategory = tax.TaxSubtotal?.TaxCategory;
        this.logger.logInfo(`TaxCategory ID: ${taxCategory?.ID}`);
        this.logger.logInfo(`Percent: ${taxCategory?.Percent}`);
        this.logger.logInfo(`TaxScheme ID: ${taxCategory?.TaxScheme?.ID}`);

        this.logger.logInfo('\nINVOICE LINES');
        const lines = Array.isArray(invoice.InvoiceLine)
          ? invoice.InvoiceLine
          : [invoice.InvoiceLine];
        lines.forEach((line, index) => {
          this.logger.logInfo(`\nLine ${index + 1}`);
          this.logger.logInfo(`ID: ${line.ID}`);
          this.logger.logInfo(
            `Quantity: ${line.InvoicedQuantity?._ || line.InvoicedQuantity}`,
          );
          this.logger.logInfo(
            `Amount: ${JSON.stringify(line.LineExtensionAmount)}`,
          );
          const item = line.Item;
          this.logger.logInfo(`Product Description: ${item.Description}`);
          this.logger.logInfo(`Product Name: ${item.Name}`);
          this.logger.logInfo(
            `Product ID: ${item.SellersItemIdentification?.ID}`,
          );
          this.logger.logInfo(
            `Price: ${JSON.stringify(line.Price?.PriceAmount)}`,
          );
        });

        txResult.witness = {} as any; // TODO
        break;

      default:
        throw new Error(
          `Unsupported workstep type: ${workstep.workstepConfig.type}`,
        );
    }

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
      process.env.VERIFIER_CONTRACTS_PATH +
      workgroupName +
      'Workgroup' +
      '/' +
      snakeCaseWorkstepName +
      'Verifier.sol' +
      '/' +
      this.capitalized(workstepName) +
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

  private capitalized = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  private async prepareCircuitInputs(
    tx: Transaction,
    circuitInputsTranslationSchema: string,
    payloadFormatType: PayloadFormatType,
  ): Promise<object> {
    const payloadAsCircuitInputs = await this.preparePayloadAsCircuitInputs(
      tx,
      circuitInputsTranslationSchema,
      payloadFormatType,
    );

    return payloadAsCircuitInputs;
  }

  private async preparePayloadAsCircuitInputs(
    tx: Transaction,
    workstepTranslationSchema: string,
    payloadFormatType: PayloadFormatType,
  ): Promise<object> {
    const schema = JSON.parse(workstepTranslationSchema);
    if (!schema) {
      throw new Error(`Broken mapping`);
    }
    let parsedInputs;
    if ('extractions' in schema) {
      const generalSchema = schema as GeneralCircuitInputsMapping;
      parsedInputs =
        await this.circuitInputsParserService.applyGeneralMappingToTxPayload(
          tx.payload,
          payloadFormatType,
          generalSchema,
        );
      if (!parsedInputs) {
        throw new Error(`Failed to parse inputs`);
      }
    } else {
      const circuitSchema = schema as CircuitInputsMapping;
      parsedInputs =
        await this.circuitInputsParserService.applyMappingToTxPayload(
          tx.payload,
          payloadFormatType,
          circuitSchema,
        );
      if (!parsedInputs) {
        throw new Error(`Failed to parse inputs`);
      }
    }
    if (!(schema.mapping.length === 0)) {
      return Object.assign(parsedInputs, await computeEddsaSigPublicInputs(tx));
    }

    return Object.assign(parsedInputs);
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
