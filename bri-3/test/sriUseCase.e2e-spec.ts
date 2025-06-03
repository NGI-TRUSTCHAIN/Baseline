import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ethers, JsonRpcProvider } from 'ethers';
import MerkleTree from 'merkletreejs';
import * as request from 'supertest';
import { v4 } from 'uuid';
import { AppModule } from '../src/app.module';
import { BpiMerkleTree } from '../src/bri/merkleTree/models/bpiMerkleTree';
import { MerkleTreeService } from '../src/bri/merkleTree/services/merkleTree.service';
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
import {
  PayloadFormatType,
  WorkstepConfig,
  WorkstepType,
} from '../src/bri/workgroup/worksteps/models/workstep';
import * as dotenv from 'dotenv';
import { ApiClient } from './helpers/apiClient';
import { BpiService } from './helpers/bpiService';
dotenv.config();

jest.setTimeout(240000);
const server = 'http://localhost:3000';

let bpiService: BpiService;

let supplierBpiSubjectEddsaPublicKey: string;
let supplierBpiSubjectEddsaPrivateKey: string;
let buyerBpiSubjectEddsaPublicKey: string;
let buyerBpiSubjectEddsaPrivateKey: string;
let createdWorkgroupId: string;
let createdWorkstep1Id: string;
let createdWorkstep2Id: string;
let createdWorkstep3Id: string;
let createdWorkflowId: string;
let createdBpiSubjectAccountSupplierId: string;
let createdBpiSubjectAccountBuyerId: string;
let createdTransaction1Id: string;
let createdTransaction2Id: string;
let createdTransaction3Id: string;

describe('SRI use-case end-to-end test', () => {
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

    // Initialize API client and service
    const accessToken = await new BpiService(
      new ApiClient(server, ''),
    ).loginAsInternalBpiSubject(
      internalBpiSubjectEcdsaPublicKey,
      internalBpiSubjectEcdsaPrivateKey,
    );

    bpiService = new BpiService(new ApiClient(server, accessToken));
  });

  it('Logs in an internal Bpi Subject, creates two external Bpi Subjects (Supplier and Buyer) and a Workgroup and adds the created Bpi Subjects as participants to the Workgroup', async () => {
    const createdBpiSubjectSupplierId =
      await bpiService.createExternalBpiSubject(
        'External Bpi Subject - Supplier',
        [
          { type: 'ecdsa', value: supplierBpiSubjectEcdsaPublicKey },
          { type: 'eddsa', value: supplierBpiSubjectEddsaPublicKey },
        ],
      );

    createdBpiSubjectAccountSupplierId =
      await bpiService.createBpiSubjectAccount(
        createdBpiSubjectSupplierId,
        createdBpiSubjectSupplierId,
      );

    const createdBpiSubjectBuyerId = await bpiService.createExternalBpiSubject(
      'External Bpi Subject 2 - Buyer',
      [
        { type: 'ecdsa', value: buyerBpiSubjectEcdsaPublicKey },
        { type: 'eddsa', value: buyerBpiSubjectEddsaPublicKey },
      ],
    );

    createdBpiSubjectAccountBuyerId = await bpiService.createBpiSubjectAccount(
      createdBpiSubjectBuyerId,
      createdBpiSubjectBuyerId,
    );

    createdWorkgroupId = await bpiService.createWorkgroup();

    await bpiService.updateWorkgroup(
      createdWorkgroupId,
      [createdBpiSubjectSupplierId],
      [createdBpiSubjectSupplierId, createdBpiSubjectBuyerId],
    );

    const resultWorkgroup = await bpiService.fetchWorkgroup(createdWorkgroupId);
    expect(resultWorkgroup.participants.length).toBe(2);
    expect(resultWorkgroup.participants[0].id).toEqual(
      createdBpiSubjectSupplierId,
    );
    expect(resultWorkgroup.participants[1].id).toEqual(
      createdBpiSubjectBuyerId,
    );
  });

  it('Sets up a workflow with 3 worksteps in the previously created workgroup', async () => {
    createdWorkstep1Id = await bpiService.createWorkstep(
      'workstep1',
      createdWorkgroupId,
      {
        type: WorkstepType.BLOCKCHAIN,
        executionParams: {
          verifierContractAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        },
        payloadFormatType: PayloadFormatType.JSON,
      },
    );

    createdWorkstep2Id = await bpiService.createWorkstep(
      'workstep2',
      createdWorkgroupId,
      {
        type: WorkstepType.BLOCKCHAIN,
        executionParams: {
          verifierContractAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        },
        payloadFormatType: PayloadFormatType.JSON,
      },
    );

    createdWorkstep3Id = await bpiService.createWorkstep(
      'workstep3',
      createdWorkgroupId,
      {
        type: WorkstepType.BLOCKCHAIN,
        executionParams: {
          verifierContractAddress: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
        },
        payloadFormatType: PayloadFormatType.JSON,
      },
    );

    createdWorkflowId = await bpiService.createWorkflow(
      'worksflow1',
      createdWorkgroupId,
      [createdWorkstep1Id, createdWorkstep2Id, createdWorkstep3Id],
      [createdBpiSubjectAccountSupplierId, createdBpiSubjectAccountBuyerId],
    );
  });

  it('Add a circuit input translation schema to workstep 1', async () => {
    const schema = `{
          "mapping": [
            {
              "circuitInput": "invoiceStatus", 
              "description": "Invoice status", 
              "payloadJsonPath": "status", 
              "dataType": "string"
            },
            {
              "circuitInput": "invoiceAmount", 
              "description": "Total gross amount of the invoice", 
              "payloadJsonPath": "amount", 
              "dataType": "integer"
            },
            {
              "circuitInput": "itemPrices", 
              "description": "Invoice item prices", 
              "payloadJsonPath": "items", 
              "dataType": "array",
              "arrayType": "object",
              "arrayItemFieldName": "price",
              "arrayItemFieldType": "integer"
            },
            {
              "circuitInput": "itemAmount", 
              "description": "Invoice item amounts", 
              "payloadJsonPath": "items", 
              "dataType": "array",
              "arrayType": "object",
              "arrayItemFieldName": "amount",
              "arrayItemFieldType": "integer"
            }
          ]
        }`;
    await bpiService.addCircuitInputsSchema(createdWorkstep1Id, schema);
  });

  it('Add a circuit input translation schema to workstep 2', async () => {
    const schema = `{
          "mapping": [
            {
              "circuitInput": "invoiceStatus", 
              "description": "Invoice status", 
              "payloadJsonPath": "status", 
              "dataType": "string"
            }
          ]
        }`;
    await bpiService.addCircuitInputsSchema(createdWorkstep2Id, schema);
  });

  it('Add a circuit input translation schema to workstep 3', async () => {
    const schema = `{
          "mapping": [
            {
              "circuitInput": "invoiceStatus", 
              "description": "Invoice status", 
              "payloadJsonPath": "status", 
              "dataType": "string"
            }
          ]
        }`;
    await bpiService.addCircuitInputsSchema(createdWorkstep3Id, schema);
  });

  it('Submits transaction 1 for execution of the workstep 1', async () => {
    createdTransaction1Id = await bpiService.createTransaction(
      v4(),
      1,
      createdWorkflowId,
      createdWorkstep1Id,
      createdBpiSubjectAccountSupplierId,
      supplierBpiSubjectEddsaPrivateKey,
      createdBpiSubjectAccountBuyerId,
      `{
        "supplierInvoiceID": "INV123",
        "amount": 300,
        "issueDate": "2023-06-15",
        "dueDate": "2023-07-15",
        "status": "NEW",
        "items": [
          { "id": 1, "productId": "product1", "price": 100, "amount": 1 },
          { "id": 2, "productId": "product2", "price": 200, "amount": 1 },
          { "id": 3, "productId": "placeholder", "price": 0, "amount": 0 },
          { "id": 4, "productId": "placeholder", "price": 0, "amount": 0 }
        ]
      }`,
    );
  });

  it('Waits for a single VSM cycle and then verifies that transaction 1 has been executed and that the state has been properly stored on chain and off chain', async () => {
    await new Promise((r) => setTimeout(r, 50000));
    const resultWorkflow = await bpiService.fetchWorkflow(createdWorkflowId);
    const resultBpiAccount = await bpiService.fetchBpiAccount(
      resultWorkflow.bpiAccountId,
    );

    const stateBpiMerkleTree = new BpiMerkleTree(
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
      historyBpiMerkleTree.getLeafIndex(stateBpiMerkleTree.getRoot()),
    ).toBe(0);

    const resultTransaction = await bpiService.fetchTransaction(
      createdTransaction1Id,
    );
    const resultWorkstepInstanceId = resultTransaction.workstepInstanceId;

    const contract = getContractFromLocalNode();
    const contentAddressableHash = await contract.getAnchorHash(
      resultWorkstepInstanceId,
    );

    expect(contentAddressableHash).toBeTruthy();
    expect(contentAddressableHash.length).toBeGreaterThan(0);

    expect(stateBpiMerkleTree.getLeaf(0)).toEqual(contentAddressableHash);

    const stateTreeLeafValue = await bpiService.fetchStateTreeLeafViaCAH(
      contentAddressableHash,
    );

    expect(stateTreeLeafValue).toBeTruthy();
    expect(stateTreeLeafValue.leafIndex).toBe(0);
  });

  it('Submits transaction 2 for execution of the workstep 2', async () => {
    createdTransaction2Id = await bpiService.createTransaction(
      v4(),
      1,
      createdWorkflowId,
      createdWorkstep2Id,
      createdBpiSubjectAccountBuyerId,
      buyerBpiSubjectEddsaPrivateKey,
      createdBpiSubjectAccountSupplierId,
      `{
        "supplierInvoiceID": "INV123",
        "amount": 300,
        "issueDate": "2023-06-15",
        "dueDate": "2023-07-15",
        "status": "VERIFIED",
        "items": [
          { "id": 1, "productId": "product1", "price": 100, "amount": 1 },
          { "id": 2, "productId": "product2", "price": 200, "amount": 1 },
          { "id": 3, "productId": "placeholder", "price": 0, "amount": 0 },
          { "id": 4, "productId": "placeholder", "price": 0, "amount": 0 }
        ]
      }`,
    );
  });

  it('Waits for a single VSM cycle and then verifies that the transaction 2 has been executed and that the state has been properly stored on chain and off chain', async () => {
    await new Promise((r) => setTimeout(r, 50000));
    const resultWorkflow = await bpiService.fetchWorkflow(createdWorkflowId);
    const resultBpiAccount = await bpiService.fetchBpiAccount(
      resultWorkflow.bpiAccountId,
    );

    const stateBpiMerkleTree = new BpiMerkleTree(
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
      historyBpiMerkleTree.getLeafIndex(stateBpiMerkleTree.getRoot()),
    ).toBe(1);

    const resultTransaction = await bpiService.fetchTransaction(
      createdTransaction2Id,
    );
    const resultWorkstepInstanceId = resultTransaction.workstepInstanceId;

    const contract = getContractFromLocalNode();
    const contentAddressableHash = await contract.getAnchorHash(
      resultWorkstepInstanceId,
    );

    expect(contentAddressableHash).toBeTruthy();
    expect(contentAddressableHash.length).toBeGreaterThan(0);

    expect(stateBpiMerkleTree.getLeaf(1)).toEqual(contentAddressableHash);

    const stateTreeLeafValue = await bpiService.fetchStateTreeLeafViaCAH(
      contentAddressableHash,
    );

    expect(stateTreeLeafValue).toBeTruthy();
    expect(stateTreeLeafValue.leafIndex).toBe(1);
  });

  it('Submits transaction 3 for execution of the workstep 3', async () => {
    createdTransaction3Id = await bpiService.createTransaction(
      v4(),
      2,
      createdWorkflowId,
      createdWorkstep3Id,
      createdBpiSubjectAccountBuyerId,
      buyerBpiSubjectEddsaPrivateKey,
      createdBpiSubjectAccountSupplierId,
      `{
        "supplierInvoiceID": "INV123",
        "amount": 300,
        "issueDate": "2023-06-15",
        "dueDate": "2023-07-15",
        "status": "PAID",
        "items": [
          { "id": 1, "productId": "product1", "price": 100, "amount": 1 },
          { "id": 2, "productId": "product2", "price": 200, "amount": 1 },
          { "id": 3, "productId": "placeholder", "price": 0, "amount": 0 },
          { "id": 4, "productId": "placeholder", "price": 0, "amount": 0 }
        ]
      }`,
    );
  });

  it('Waits for a single VSM cycle and then verifies that the transaction 3 has been executed and that the state has been properly stored on chain and off chain', async () => {
    await new Promise((r) => setTimeout(r, 50000));
    const resultWorkflow = await bpiService.fetchWorkflow(createdWorkflowId);
    const resultBpiAccount = await bpiService.fetchBpiAccount(
      resultWorkflow.bpiAccountId,
    );

    const stateBpiMerkleTree = new BpiMerkleTree(
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
      historyBpiMerkleTree.getLeafIndex(stateBpiMerkleTree.getRoot()),
    ).toBe(2);

    const resultTransaction = await bpiService.fetchTransaction(
      createdTransaction3Id,
    );
    const resultWorkstepInstanceId = resultTransaction.workstepInstanceId;

    const contract = getContractFromLocalNode();
    const contentAddressableHash = await contract.getAnchorHash(
      resultWorkstepInstanceId,
    );

    expect(contentAddressableHash).toBeTruthy();
    expect(contentAddressableHash.length).toBeGreaterThan(0);

    expect(stateBpiMerkleTree.getLeaf(2)).toEqual(contentAddressableHash);

    const stateTreeLeafValue = await bpiService.fetchStateTreeLeafViaCAH(
      contentAddressableHash,
    );

    expect(stateTreeLeafValue).toBeTruthy();
    expect(stateTreeLeafValue.leafIndex).toBe(2);
  });
});

function getContractFromLocalNode(): ethers.Contract {
  const provider = new JsonRpcProvider(process.env.LOCALHOST_RPC_URL);
  const contractAddress = `${process.env.LOCALHOST_CCSM_CONTRACT_ADDRESS}`;

  const contractABI = [
    'function getAnchorHash(string calldata _workstepInstanceId) external view returns (string memory)',
  ];

  return new ethers.Contract(contractAddress, contractABI, provider);
}
