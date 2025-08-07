import { ethers, JsonRpcProvider } from 'ethers';
import MerkleTree from 'merkletreejs';
import { v4 } from 'uuid';
import { BpiMerkleTree } from '../src/bri/merkleTree/models/bpiMerkleTree';
import { MerkleTreeService } from '../src/bri/merkleTree/services/merkleTree.service';
import {
  PayloadFormatType,
  WorkstepConfig,
  WorkstepType,
} from '../src/bri/workgroup/worksteps/models/workstep';
import {
  buyerBpiSubjectEcdsaPrivateKey,
  buyerBpiSubjectEcdsaPublicKey,
  internalBpiSubjectEcdsaPrivateKey,
  internalBpiSubjectEcdsaPublicKey,
  supplierBpiSubjectEcdsaPrivateKey,
  supplierBpiSubjectEcdsaPublicKey,
} from '../src/shared/testing/constants';
import {
  createEddsaPrivateKey,
  createEddsaPublicKey,
  createEddsaSignature,
} from '../src/shared/testing/utils';
import { ApiClient } from './helpers/apiClient';
import { BpiService } from './helpers/bpiService';
import * as path from 'path';
import * as fs from 'fs';
import 'dotenv/config';

jest.setTimeout(240000);

const server = 'http://localhost:3000';
const server2 = 'http://localhost:3001';

let bpiService1: BpiService;
let bpiService2: BpiService;

let supplierBpiSubjectEddsaPublicKey: string;
let supplierBpiSubjectEddsaPrivateKey: string;
let buyerBpiSubjectEddsaPublicKey: string;
let buyerBpiSubjectEddsaPrivateKey: string;
let createdWorkgroupId: string;
let createdWorkgroupId2: string;
let createdWorkstep1Id: string;
let createdWorkstep2Id: string;
let createdWorkstep3Id: string;
let createdWorkstep4Id: string;
let createdWorkflowId: string;
let createdBpiSubjectAccountSupplierId: string;
let createdBpiSubjectAccountBuyerId: string;
let createdTransactionApiId: string;
let createdBpiSubjectBuyerId: string;
let createdBpiSubjectSupplierId: string;
let createdBpiSubjectAccountSupplierId2: string;
let createdBpiSubjectAccountBuyerId2: string;
let createdTransactionApiId2: string;
let createdBpiSubjectBuyerId2: string;
let createdBpiSubjectSupplierId2: string;
let stateBpiMerkleTree1: BpiMerkleTree;
let stateBpiMerkleTree2: BpiMerkleTree;
let stateBpiMerkleTree3: BpiMerkleTree;
let stateBpiMerkleTree4: BpiMerkleTree;
let createdTransaction1Id: string;
let createdTransaction2Id: string;
let createdTransaction3Id: string;
let createdTransaction4Id: string;
let contract1: ethers.Contract;
let contract2: ethers.Contract;

describe('Invoice origination use-case end-to-end test', () => {
  beforeAll(async () => {
    const supplierWallet = new ethers.Wallet(supplierBpiSubjectEcdsaPrivateKey);
    supplierBpiSubjectEddsaPrivateKey = await createEddsaPrivateKey(
      supplierBpiSubjectEcdsaPublicKey,
      supplierWallet,
    );
    supplierBpiSubjectEddsaPublicKey = await createEddsaPublicKey(
      supplierBpiSubjectEddsaPrivateKey,
    );

    const buyerWallet = new ethers.Wallet(buyerBpiSubjectEcdsaPrivateKey);
    buyerBpiSubjectEddsaPrivateKey = await createEddsaPrivateKey(
      buyerBpiSubjectEcdsaPublicKey,
      buyerWallet,
    );
    buyerBpiSubjectEddsaPublicKey = await createEddsaPublicKey(
      buyerBpiSubjectEddsaPrivateKey,
    );

    // Initialize API clients and services
    const accessToken1 = await new BpiService(
      new ApiClient(server, ''),
    ).loginAsInternalBpiSubject(
      internalBpiSubjectEcdsaPublicKey,
      internalBpiSubjectEcdsaPrivateKey,
    );
    const accessToken2 = await new BpiService(
      new ApiClient(server2, ''),
    ).loginAsInternalBpiSubject(
      internalBpiSubjectEcdsaPublicKey,
      internalBpiSubjectEcdsaPrivateKey,
    );

    bpiService1 = new BpiService(new ApiClient(server, accessToken1));
    bpiService2 = new BpiService(new ApiClient(server2, accessToken2));

    contract1 = getContractFromLocalNode(
      process.env.LOCALHOST_RPC_URL as string,
    );
    contract2 = getContractFromLocalNode(
      process.env.LOCALHOST_RPC_URL2 as string,
    );
  });

  describe('Serbia BPI service', () => {
    jest.setTimeout(800000);
    it('Logs in an internal Bpi Subject, creates two external Bpi Subjects (Supplier and Buyer) and a Workgroup and adds the created Bpi Subjects as participants to the Workgroup', async () => {
      // bpi1
      createdBpiSubjectSupplierId = await bpiService1.createExternalBpiSubject(
        'External Bpi Subject - Supplier',
        [
          { type: 'ecdsa', value: supplierBpiSubjectEcdsaPublicKey },
          { type: 'eddsa', value: supplierBpiSubjectEddsaPublicKey },
        ],
      );

      createdBpiSubjectAccountSupplierId =
        await bpiService1.createBpiSubjectAccount(
          createdBpiSubjectSupplierId,
          createdBpiSubjectSupplierId,
        );

      createdBpiSubjectBuyerId = await bpiService1.createExternalBpiSubject(
        'External Bpi Subject 2 - Buyer',
        [
          { type: 'ecdsa', value: buyerBpiSubjectEcdsaPublicKey },
          { type: 'eddsa', value: buyerBpiSubjectEddsaPublicKey },
        ],
      );

      createdBpiSubjectAccountBuyerId =
        await bpiService1.createBpiSubjectAccount(
          createdBpiSubjectBuyerId,
          createdBpiSubjectBuyerId,
        );

      // workgroup on bpi1
      createdWorkgroupId = await bpiService1.createWorkgroup('origination');

      await bpiService1.updateWorkgroup(
        createdWorkgroupId,
        'origination',
        [createdBpiSubjectSupplierId],
        [createdBpiSubjectSupplierId, createdBpiSubjectBuyerId],
      );

      const resultWorkgroup =
        await bpiService1.fetchWorkgroup(createdWorkgroupId);
      expect(resultWorkgroup.participants.length).toBe(2);
      expect(resultWorkgroup.participants[0].id).toEqual(
        createdBpiSubjectSupplierId,
      );
      expect(resultWorkgroup.participants[1].id).toEqual(
        createdBpiSubjectBuyerId,
      );
    });

    it('Sets up a workflow with a 4 worksteps', async () => {
      createdWorkstep1Id = await bpiService1.createWorkstep(
        'serbiaWorkstep1',
        createdWorkgroupId,
        {
          type: WorkstepType.PAYLOAD_FROM_USER,
          executionParams: {
            verifierContractAddress:
              '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
          },
          payloadFormatType: PayloadFormatType.XML,
        },
      );

      createdWorkstep2Id = await bpiService1.createWorkstep(
        'serbiaWorkstep2',
        createdWorkgroupId,
        {
          type: WorkstepType.PAYLOAD_FROM_API,
          executionParams: {
            verifierContractAddress:
              '0x0165878A594ca255338adfa4d48449f69242Eb8F',
            apiUrl: process.env.EFAKTURA_URL,
          },
          payloadFormatType: PayloadFormatType.XML,
        },
      );

      createdWorkstep3Id = await bpiService1.createWorkstep(
        'serbiaWorkstep3',
        createdWorkgroupId,
        {
          type: WorkstepType.PAYLOAD_FROM_USER,
          executionParams: {
            verifierContractAddress:
              '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
          },
          payloadFormatType: PayloadFormatType.XML,
        },
      );

      //TODO: PayloadFormatType for workstep 4 maybe be JSON or XML, depending on return type of API call
      createdWorkstep4Id = await bpiService1.createWorkstep(
        'serbiaWorkstep4',
        createdWorkgroupId,
        {
          type: WorkstepType.PAYLOAD_FROM_API,
          executionParams: {
            verifierContractAddress:
              '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
          },
          payloadFormatType: PayloadFormatType.XML,
        },
      );

      createdWorkflowId = await bpiService1.createWorkflow(
        'workflow1',
        createdWorkgroupId,
        [
          createdWorkstep1Id,
          createdWorkstep2Id,
          createdWorkstep3Id,
          createdWorkstep4Id,
        ],
        [createdBpiSubjectAccountSupplierId, createdBpiSubjectAccountBuyerId],
      );
    });

    it('Add a circuit input translation schema to workstep 1', async () => {
      const schema = `{
                        "mapping": [
                             {
                                 "extractionField": "ds:Signature.ds:SignatureValue._",
                                 "payloadJsonPath": "supplierSignature",
                                 "circuitInput": "supplierSignature",
                                 "description": "Signature on the document",
                                 "dataType": "string",
                                 "checkType": "signatureCheck"
                             }
                         ]
                     }`;
      await bpiService1.addCircuitInputsSchema(createdWorkstep1Id, schema);
    });

    it('Add a circuit input translation schema to workstep 2', async () => {
      const schema = `{
            "mapping": [
              {
                "extractionField": "asic:XAdESSignatures.ds:Signature.ds:SignatureValue._",
                "payloadJsonPath": "efaktureSignature",
                "circuitInput": "efaktureSignature",
                "description": "Signature on the document",
                "dataType": "string",
                "checkType": "signatureCheck"
              },
              {
                "extractionField": "asic:XAdESSignatures.ds:Signature.ds:KeyInfo.ds:X509Data.ds:X509Certificate.subject.CN",
                "extractionParam": "x509",
                "payloadJsonPath": "signerName",
                "circuitInput": "signerName",
                "description": "Common name of certificate signer",
                "dataType": "string",
                "checkType": "merkleProof",
                "merkleTreeInputsPath": ["signerName", "signerName"]
              }
            ]
          }`;
      await bpiService1.addCircuitInputsSchema(createdWorkstep2Id, schema);
    });

    it('Add a circuit input translation schema to workstep 3', async () => {
      const schema = `{
                        "mapping": [
                          {
                            "extractionField": "SupplierSEFSalesInvoiceId",
                            "payloadJsonPath": "supplierId",
                            "circuitInput": "supplierId",
                            "description": "Supplied Id number",
                            "dataType": "string",
                            "checkType": "merkleProof",
                            "merkleTreeInputsPath": ["supplierId", "supplierId"]
                          }
                        ]
                      }`;
      await bpiService1.addCircuitInputsSchema(createdWorkstep3Id, schema);
    });

    it('Add a circuit input translation schema to workstep 4', async () => {
      //TODO: Add correct schema for checking invoice status
      const schema = `{
                        "mapping": [
                          {
                            "extractionField": "SupplierSEFSalesInvoiceId",
                            "payloadJsonPath": "invoiceStatus",
                            "circuitInput": "invoiceStatus",
                            "description": "Supplied Id number",
                            "dataType": "string",
                            "checkType": "merkleProof",
                            "merkleTreeInputsPath": ["invoiceStatus", "invoiceStatus"]
                          }
                        ]
                      }`;
      await bpiService1.addCircuitInputsSchema(createdWorkstep4Id, schema);
    });

    it('Submits transaction for execution of the workstep 1', async () => {
      const xmlFilePath = path.join(
        __dirname,
        '../src/shared/testing/interop/supplierInvoice.xml',
      );
      const xmlContent = fs.readFileSync(xmlFilePath, 'utf-8');
      const workstep1payload = xmlContent;
      createdTransaction1Id = await bpiService1.createTransaction(
        v4(),
        3,
        createdWorkflowId,
        createdWorkstep1Id,
        createdBpiSubjectAccountBuyerId,
        buyerBpiSubjectEddsaPrivateKey,
        createdBpiSubjectAccountSupplierId,
        workstep1payload,
      );
    });

    it('Waits for a single VSM cycle and then verifies that the transaction 1 has been executed', async () => {
      const resultWorkflow = await bpiService1.fetchWorkflow(createdWorkflowId);
      const resultBpiAccount = await waitForTreeUpdate(
        bpiService1,
        resultWorkflow.bpiAccountId,
        1,
      );

      stateBpiMerkleTree1 = new BpiMerkleTree(
        'ttt',
        'sha256',
        MerkleTree.unmarshalTree(
          resultBpiAccount.stateTree.tree,
          new MerkleTreeService().createHashFunction('sha256'),
        ),
      );
      const historyBpiMerkleTree = new BpiMerkleTree(
        'ttt',
        'sha256',
        MerkleTree.unmarshalTree(
          resultBpiAccount.historyTree.tree,
          new MerkleTreeService().createHashFunction('sha256'),
        ),
      );

      expect(
        historyBpiMerkleTree.getLeafIndex(stateBpiMerkleTree1.getRoot()),
      ).toBe(0);
    });

    it('Verifies the proof generated by transaction 1', async () => {
      const resultTransaction = await bpiService1.fetchTransaction(
        createdTransaction1Id,
      );
      const resultWorkstepInstanceId = resultTransaction.workstepInstanceId;

      //Verify Content Addressable Hash
      const contentAddressableHash = await contract1.getAnchorHash(
        resultWorkstepInstanceId,
      );

      expect(contentAddressableHash).toBeTruthy();
      expect(contentAddressableHash.length).toBeGreaterThan(0);
      expect(stateBpiMerkleTree1.getLeaf(0)).toEqual(contentAddressableHash);

      //Verify State Tree Leaf Value
      const stateTreeLeafValue = await bpiService1.fetchStateTreeLeafViaCAH(
        contentAddressableHash,
      );

      expect(stateTreeLeafValue).toBeTruthy();
      expect(stateTreeLeafValue.leafIndex).toBe(0);

      //Verify ZK proof on chain
      const verifiedTransactionResult =
        await bpiService1.verifyTransactionResult(
          resultTransaction.workflowId,
          resultTransaction.workstepId,
          JSON.stringify(stateTreeLeafValue),
        );

      expect(verifiedTransactionResult).toBeTruthy();
    });

    it('Submits transaction for execution of the workstep 2', async () => {
      const xmlFilePath = path.join(
        __dirname,
        '../src/shared/testing/interop/supplierInvoice.xml',
      ); //API call to EFAKTURA with this file should generate the content of signatures0.xml file
      const xmlContent = fs.readFileSync(xmlFilePath, 'utf-8');
      const workstep2payload = {
        method: 'GET',
        apiKey: process.env.EFAKTURA_API_KEY,
        headers: {},
        queryParams: {
          invoiceId: '1',
        },
        body: xmlContent,
      };
      createdTransaction2Id = await bpiService1.createTransaction(
        v4(),
        3,
        createdWorkflowId,
        createdWorkstep2Id,
        createdBpiSubjectAccountBuyerId,
        buyerBpiSubjectEddsaPrivateKey,
        createdBpiSubjectAccountSupplierId,
        JSON.stringify(workstep2payload),
      );
    });

    it('Waits for a single VSM cycle and then verifies that the transaction 2 has been executed', async () => {
      const resultWorkflow = await bpiService1.fetchWorkflow(createdWorkflowId);
      const resultBpiAccount = await waitForTreeUpdate(
        bpiService1,
        resultWorkflow.bpiAccountId,
        2,
      );

      stateBpiMerkleTree2 = new BpiMerkleTree(
        'ttt',
        'sha256',
        MerkleTree.unmarshalTree(
          resultBpiAccount.stateTree.tree,
          new MerkleTreeService().createHashFunction('sha256'),
        ),
      );
      const historyBpiMerkleTree = new BpiMerkleTree(
        'ttt',
        'sha256',
        MerkleTree.unmarshalTree(
          resultBpiAccount.historyTree.tree,
          new MerkleTreeService().createHashFunction('sha256'),
        ),
      );

      expect(
        historyBpiMerkleTree.getLeafIndex(stateBpiMerkleTree2.getRoot()),
      ).toBe(1);
    });

    it('Verifies the proof generated by transaction 2', async () => {
      const resultTransaction = await bpiService1.fetchTransaction(
        createdTransaction2Id,
      );
      const resultWorkstepInstanceId = resultTransaction.workstepInstanceId;

      //Verify Content Addressable Hash
      const contentAddressableHash = await contract1.getAnchorHash(
        resultWorkstepInstanceId,
      );

      expect(contentAddressableHash).toBeTruthy();
      expect(contentAddressableHash.length).toBeGreaterThan(0);
      expect(stateBpiMerkleTree2.getLeaf(1)).toEqual(contentAddressableHash);

      //Verify State Tree Leaf Value
      const stateTreeLeafValue = await bpiService1.fetchStateTreeLeafViaCAH(
        contentAddressableHash,
      );

      expect(stateTreeLeafValue).toBeTruthy();
      expect(stateTreeLeafValue.leafIndex).toBe(1);

      //Verify ZK proof on chain
      const verifiedTransactionResult =
        await bpiService1.verifyTransactionResult(
          resultTransaction.workflowId,
          resultTransaction.workstepId,
          JSON.stringify(stateTreeLeafValue),
        );

      expect(verifiedTransactionResult).toBeTruthy();
    });

    it('Submits transaction for execution of the workstep 3', async () => {
      const xmlFilePath = path.join(
        __dirname,
        '../src/shared/testing/interop/supplierInvoice.xml',
      );
      const xmlContent = fs.readFileSync(xmlFilePath, 'utf-8');
      const workstep3payload = xmlContent;

      createdTransaction3Id = await bpiService1.createTransaction(
        v4(),
        3,
        createdWorkflowId,
        createdWorkstep3Id,
        createdBpiSubjectAccountBuyerId,
        buyerBpiSubjectEddsaPrivateKey,
        createdBpiSubjectAccountSupplierId,
        workstep3payload,
      );
    });

    it('Waits for a single VSM cycle and then verifies that the transaction 3 has been executed', async () => {
      const resultWorkflow = await bpiService1.fetchWorkflow(createdWorkflowId);
      const resultBpiAccount = await waitForTreeUpdate(
        bpiService1,
        resultWorkflow.bpiAccountId,
        3,
      );

      stateBpiMerkleTree3 = new BpiMerkleTree(
        'ttt',
        'sha256',
        MerkleTree.unmarshalTree(
          resultBpiAccount.stateTree.tree,
          new MerkleTreeService().createHashFunction('sha256'),
        ),
      );
      const historyBpiMerkleTree = new BpiMerkleTree(
        'ttt',
        'sha256',
        MerkleTree.unmarshalTree(
          resultBpiAccount.historyTree.tree,
          new MerkleTreeService().createHashFunction('sha256'),
        ),
      );

      expect(
        historyBpiMerkleTree.getLeafIndex(stateBpiMerkleTree3.getRoot()),
      ).toBe(2);
    });

    it('Verifies the proof generated by transaction 3', async () => {
      const resultTransaction = await bpiService1.fetchTransaction(
        createdTransaction3Id,
      );
      const resultWorkstepInstanceId = resultTransaction.workstepInstanceId;

      //Verify Content Addressable Hash
      const contentAddressableHash = await contract1.getAnchorHash(
        resultWorkstepInstanceId,
      );

      expect(contentAddressableHash).toBeTruthy();
      expect(contentAddressableHash.length).toBeGreaterThan(0);
      expect(stateBpiMerkleTree3.getLeaf(2)).toEqual(contentAddressableHash);

      //Verify State Tree Leaf Value
      const stateTreeLeafValue = await bpiService1.fetchStateTreeLeafViaCAH(
        contentAddressableHash,
      );

      expect(stateTreeLeafValue).toBeTruthy();
      expect(stateTreeLeafValue.leafIndex).toBe(2);

      //Verify ZK proof on chain
      const verifiedTransactionResult =
        await bpiService1.verifyTransactionResult(
          resultTransaction.workflowId,
          resultTransaction.workstepId,
          JSON.stringify(stateTreeLeafValue),
        );

      expect(verifiedTransactionResult).toBeTruthy();
    });

    it.skip('Submits transaction for execution of the workstep 4', async () => {
      //TODO: Add correct payload file for checking invoice status
      const xmlFilePath = path.join(
        __dirname,
        '../src/shared/testing/interop/verifiedSupplierInvoice.xml',
      );
      const xmlContent = fs.readFileSync(xmlFilePath, 'utf-8');
      const workstep4payload = {
        method: 'GET',
        apiKey: process.env.EFAKTURA_API_KEY,
        headers: {},
        queryParams: {
          invoiceId: '1',
        },
        body: xmlContent,
      };

      createdTransaction4Id = await bpiService1.createTransaction(
        v4(),
        3,
        createdWorkflowId,
        createdWorkstep4Id,
        createdBpiSubjectAccountBuyerId,
        buyerBpiSubjectEddsaPrivateKey,
        createdBpiSubjectAccountSupplierId,
        JSON.stringify(workstep4payload),
      );
    });

    it.skip('Waits for a single VSM cycle and then verifies that the transaction 4 has been executed', async () => {
      const resultWorkflow = await bpiService1.fetchWorkflow(createdWorkflowId);
      const resultBpiAccount = await waitForTreeUpdate(
        bpiService1,
        resultWorkflow.bpiAccountId,
        4,
      );

      stateBpiMerkleTree4 = new BpiMerkleTree(
        'ttt',
        'sha256',
        MerkleTree.unmarshalTree(
          resultBpiAccount.stateTree.tree,
          new MerkleTreeService().createHashFunction('sha256'),
        ),
      );
      const historyBpiMerkleTree = new BpiMerkleTree(
        'ttt',
        'sha256',
        MerkleTree.unmarshalTree(
          resultBpiAccount.historyTree.tree,
          new MerkleTreeService().createHashFunction('sha256'),
        ),
      );

      expect(
        historyBpiMerkleTree.getLeafIndex(stateBpiMerkleTree4.getRoot()),
      ).toBe(3);
    });

    it.skip('Verifies the proof generated by transaction 4', async () => {
      const resultTransaction = await bpiService1.fetchTransaction(
        createdTransaction4Id,
      );
      const resultWorkstepInstanceId = resultTransaction.workstepInstanceId;

      //Verify Content Addressable Hash
      const contentAddressableHash = await contract1.getAnchorHash(
        resultWorkstepInstanceId,
      );

      expect(contentAddressableHash).toBeTruthy();
      expect(contentAddressableHash.length).toBeGreaterThan(0);
      expect(stateBpiMerkleTree4.getLeaf(3)).toEqual(contentAddressableHash);

      //Verify State Tree Leaf Value
      const stateTreeLeafValue = await bpiService1.fetchStateTreeLeafViaCAH(
        contentAddressableHash,
      );

      expect(stateTreeLeafValue).toBeTruthy();
      expect(stateTreeLeafValue.leafIndex).toBe(3);

      //Verify ZK proof on chain
      const verifiedTransactionResult =
        await bpiService1.verifyTransactionResult(
          resultTransaction.workflowId,
          resultTransaction.workstepId,
          JSON.stringify(stateTreeLeafValue),
        );

      expect(verifiedTransactionResult).toBeTruthy();
    });
  });

  describe('Romania BPI service', () => {
    jest.setTimeout(800000);
    it('Logs in an internal Bpi Subject, creates two external Bpi Subjects (Supplier and Buyer) and a Workgroup and adds the created Bpi Subjects as participants to the Workgroup', async () => {
      // bpi2
      createdBpiSubjectSupplierId2 = await bpiService2.createExternalBpiSubject(
        'External Bpi Subject - Supplier',
        [
          { type: 'ecdsa', value: supplierBpiSubjectEcdsaPublicKey },
          { type: 'eddsa', value: supplierBpiSubjectEddsaPublicKey },
        ],
      );

      createdBpiSubjectAccountSupplierId2 =
        await bpiService2.createBpiSubjectAccount(
          createdBpiSubjectSupplierId2,
          createdBpiSubjectSupplierId2,
        );

      createdBpiSubjectBuyerId2 = await bpiService2.createExternalBpiSubject(
        'External Bpi Subject 2 - Buyer',
        [
          { type: 'ecdsa', value: buyerBpiSubjectEcdsaPublicKey },
          { type: 'eddsa', value: buyerBpiSubjectEddsaPublicKey },
        ],
      );

      createdBpiSubjectAccountBuyerId2 =
        await bpiService2.createBpiSubjectAccount(
          createdBpiSubjectBuyerId2,
          createdBpiSubjectBuyerId2,
        );

      // workgroup on bpi2
      createdWorkgroupId2 = await bpiService2.createWorkgroup('origination');

      await bpiService2.updateWorkgroup(
        createdWorkgroupId2,
        'origination',
        [createdBpiSubjectSupplierId2],
        [createdBpiSubjectSupplierId2, createdBpiSubjectBuyerId2],
      );

      const resultWorkgroup2 =
        await bpiService2.fetchWorkgroup(createdWorkgroupId2);
      expect(resultWorkgroup2.participants.length).toBe(2);
      expect(resultWorkgroup2.participants[0].id).toEqual(
        createdBpiSubjectSupplierId2,
      );
      expect(resultWorkgroup2.participants[1].id).toEqual(
        createdBpiSubjectBuyerId2,
      );
    });

    it('Sets up a workflow with a one workstep for validating supplier and buyer information provided in the invoice', async () => {
      createdWorkstep1Id = await bpiService2.createWorkstep(
        'romaniaWorkstep1',
        createdWorkgroupId2,
        {
          type: WorkstepType.PAYLOAD_FROM_USER,
          executionParams: {
            verifierContractAddress:
              '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
          },
          payloadFormatType: PayloadFormatType.JSON,
        },
      );

      createdWorkflowId = await bpiService2.createWorkflow(
        'workflow1',
        createdWorkgroupId2,
        [createdWorkstep1Id],
        [createdBpiSubjectAccountSupplierId2, createdBpiSubjectAccountBuyerId2],
      );
    });

    it('Add a circuit input translation schema to workstep 1', async () => {
      const schema = `{
                        "mapping": [
                            {
                                "extractionField": "supplier.signature_base64",
                                "payloadJsonPath": "supplierSignature",
                                "circuitInput": "supplierSignature",
                                "description": "Supplier signature on the document",
                                "dataType": "string",
                                "checkType": "signatureCheck"
                            },
                            {
                                "extractionField": "buyer.signature_base64",
                                "payloadJsonPath": "buyerSignature",
                                "circuitInput": "buyerSignature",
                                "description": "Buyer signature on the document",
                                "dataType": "string",
                                "checkType": "signatureCheck"
                            }
                        ]
                    }`;
      await bpiService2.addCircuitInputsSchema(createdWorkstep1Id, schema);
    });

    it('Submits transaction for execution of the workstep 1', async () => {
      createdTransaction1Id = await bpiService2.createTransaction(
        v4(),
        3,
        createdWorkflowId,
        createdWorkstep1Id,
        createdBpiSubjectAccountBuyerId2,
        buyerBpiSubjectEddsaPrivateKey,
        createdBpiSubjectAccountSupplierId2,
        `{
          "supplier": {
            "format": "CAdES-BES (Basic Electronic Signature)",
            "algorithm": "RSA-SHA256",
            "timestamp": "2025-06-03T12:57:16.324972",
            "signer": {
              "country": "RO",
              "organization": "SC TECH SOLUTIONS BUCURESTI SRL",
              "cui": "RO12345678",
              "email": "admin@sctestindustries.ro",
              "fullRegistration": "J40/12345/2023",
              "registrationCounty": "Bucharest (J40)",
              "year": "2023"
            },
            "certificate": {
              "issuer": "certSIGN SA (TEST)",
              "serial": "282776557463243117587615775002810695387071614761",
              "valid_from": "2025-06-03T07:26:51",
              "valid_until": "2028-06-02T07:26:51",
              "policy": "Qualified Certificate for Electronic Signatures"
            },
            "legal_framework": [
              "eIDAS Regulation (EU) No 910/2014",
              "Romanian Law 455/2001 on Electronic Signatures",
              "Romanian GEO 38/2020 on Electronic Documents"
            ],
            "signature_base64": "J8BZf5LhuTpN/KtPicXCmIO/kSVXn+hh8tE1v1k/Z9ZuhAXMKTYT8nc5wWkc3DMtCQGntkT1b75kw+fzhGWF0VZRmF4LU78FMr4sgpsu9stGPHtprhvRWvBjjF629DRxyTwK4CPGu5v/qRiWYGjXpWi9v4mKDEcYxBNQNB3+nwG36IgDQy9/mHlJX1+GXXi1RcWHXZuP2lWPFlTWZGBR+EJRQB0+XsVjDeKihHYWaqhxWdf76hc9NjQIzQWN7GOsCiey+Faru+Rmys7V49GxypenTkyHk0hvaa+/676ZclAm6Uq0JI6zFa+9C3Di9jUyIBI9/LkRqGUKSFejIBW3ig==",
            "document_hash_sha256": "302c2628fea5fdbf3d2bc3e3288068f346224aff78f3cb7b950e1a7a4f5f171c"
          },
          "buyer": {
            "format": "CAdES-BES (Basic Electronic Signature)",
            "algorithm": "RSA-SHA256",
            "timestamp": "2025-06-03T13:03:37.635966",
            "signer": {
              "country": "RO",
              "organization": "SC INNOVATE SYSTEMS TIMISOARA SRL",
              "cui": "RO87654321",
              "email": "admin@scinnovatesystems.ro",
              "fullRegistration": "J35/8765/2021",
              "registrationCounty": "Timiș (J35)",
              "year": "2021"
            },
            "certificate": {
              "issuer": "certSIGN SA (TEST)",
              "serial": "215068228859894812045338183829428970583415168537",
              "valid_from": "2025-06-03T07:31:53",
              "valid_until": "2028-06-02T07:31:53",
              "policy": "Qualified Certificate for Electronic Signatures"
            },
            "legal_framework": [
              "eIDAS Regulation (EU) No 910/2014",
              "Romanian Law 455/2001 on Electronic Signatures",
              "Romanian GEO 38/2020 on Electronic Documents"
            ],
            "signature_base64": "nQegVyRBk3UidE6vafhzRcVbnvyVgZkJP0a4AfmIB3sZQHst2w/eLIlQVo5EuIdBhkm6y5+R7yoJCyyh6QuAc0lRwuATeH19CVzmNw/zGpPETjy6lJvWJ1IFm9dGHMTquufyuuUMkf/1+xaRhNkXMo/kyyadKCO/3pU0x0U2+aT0NgTuKVmYfZ4qWInEGvqTcvI9LoLELc6K3AbqwQ8chlJ3I7AuUfuf6R1N3onp/C+//mCHsXK9SB2TlxJVzdI5xukKLD9VQqLt6w0DClCPZ9477i73k5pWSbajuqQYpDyJ2TVmnp/IhKV4gDQ/766hxnSwfewFg5RzyBe9xHVGVA==",
            "document_hash_sha256": "302c2628fea5fdbf3d2bc3e3288068f346224aff78f3cb7b950e1a7a4f5f171c"
          }
        }`,
      );
    });

    it('Waits for a single VSM cycle and then verifies that the transaction 1 has been executed', async () => {
      const resultWorkflow = await bpiService2.fetchWorkflow(createdWorkflowId);
      const resultBpiAccount = await waitForTreeUpdate(
        bpiService2,
        resultWorkflow.bpiAccountId,
        1,
      );

      stateBpiMerkleTree1 = new BpiMerkleTree(
        'ttt',
        'sha256',
        MerkleTree.unmarshalTree(
          resultBpiAccount.stateTree.tree,
          new MerkleTreeService().createHashFunction('sha256'),
        ),
      );
      const historyBpiMerkleTree = new BpiMerkleTree(
        'ttt',
        'sha256',
        MerkleTree.unmarshalTree(
          resultBpiAccount.historyTree.tree,
          new MerkleTreeService().createHashFunction('sha256'),
        ),
      );

      expect(
        historyBpiMerkleTree.getLeafIndex(stateBpiMerkleTree1.getRoot()),
      ).toBe(0);
    });

    it('Verifies the proof generated by transaction 1', async () => {
      const resultTransaction = await bpiService2.fetchTransaction(
        createdTransaction1Id,
      );
      const resultWorkstepInstanceId = resultTransaction.workstepInstanceId;

      //Verify Content Addressable Hash
      const contentAddressableHash = await contract2.getAnchorHash(
        resultWorkstepInstanceId,
      );

      expect(contentAddressableHash).toBeTruthy();
      expect(contentAddressableHash.length).toBeGreaterThan(0);
      expect(stateBpiMerkleTree1.getLeaf(0)).toEqual(contentAddressableHash);

      //Verify State Tree Leaf Value
      const stateTreeLeafValue = await bpiService2.fetchStateTreeLeafViaCAH(
        contentAddressableHash,
      );

      expect(stateTreeLeafValue).toBeTruthy();
      expect(stateTreeLeafValue.leafIndex).toBe(0);

      //Verify ZK proof on chain
      const verifiedTransactionResult =
        await bpiService2.verifyTransactionResult(
          resultTransaction.workflowId,
          resultTransaction.workstepId,
          JSON.stringify(stateTreeLeafValue),
        );

      expect(verifiedTransactionResult).toBeTruthy();
    });
  });
});

async function waitForTreeUpdate(
  bpiServiceName,
  bpiAccountId,
  workstep,
  maxTries = 10,
  delay = 20000,
) {
  for (let i = 0; i < maxTries; i++) {
    const result = await bpiServiceName.fetchBpiAccount(bpiAccountId);
    const tree = JSON.parse(result?.stateTree?.tree);
    const leaves = tree?.leaves;

    const hasLeaves =
      Array.isArray(leaves) && leaves.length > 0 && leaves.length == workstep;
    if (hasLeaves) {
      console.log('Leaves detected, returning result.');
      return result;
    }

    console.log(`[Retry ${i + 1}] Tree not yet updated. Waiting ${delay}ms...`);
    await new Promise((r) => setTimeout(r, delay));
  }

  throw new Error('State tree was not updated after maximum retries');
}

function getContractFromLocalNode(rpcUrl: string): ethers.Contract {
  const provider = new JsonRpcProvider(rpcUrl);
  const contractAddress = `${process.env.LOCALHOST_CCSM_CONTRACT_ADDRESS}`;

  const contractABI = [
    'function getAnchorHash(string calldata _workstepInstanceId) external view returns (string memory)',
  ];

  return new ethers.Contract(contractAddress, contractABI, provider);
}
