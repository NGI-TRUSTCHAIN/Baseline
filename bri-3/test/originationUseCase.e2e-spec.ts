import { ethers } from 'ethers';
import { v4 } from 'uuid';
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
  WorkstepType,
} from '../src/bri/workgroup/worksteps/models/workstep';
import { ApiClient } from './helpers/apiClient';
import { BpiService } from './helpers/bpiService';

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
  });

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

    createdBpiSubjectAccountBuyerId = await bpiService1.createBpiSubjectAccount(
      createdBpiSubjectBuyerId,
      createdBpiSubjectBuyerId,
    );

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

    // workgroup on bpi1
    createdWorkgroupId = await bpiService1.createWorkgroup();

    await bpiService1.updateWorkgroup(
      createdWorkgroupId,
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

    // workgroup on bpi2
    createdWorkgroupId2 = await bpiService2.createWorkgroup();

    await bpiService2.updateWorkgroup(
      createdWorkgroupId2,
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

  it('Sets up a workflow with a single workstep for triggering efakture API in the previously created workgroup', async () => {
    createdWorkstep1Id = await bpiService1.createWorkstep(
      'workstep1',
      createdWorkgroupId,
      {
        type: WorkstepType.API,
        executionParams: {
          apiUrl: process.env.EFAKTURA_URL,
        },
        payloadFormatType: PayloadFormatType.XML,
      },
    );

    createdWorkflowId = await bpiService1.createWorkflow(
      'workflow1',
      createdWorkgroupId,
      [createdWorkstep1Id],
      [createdBpiSubjectAccountSupplierId, createdBpiSubjectAccountBuyerId],
    );
  });

  it('Submits transaction for execution of the workstep 1 with api call', async () => {
    createdTransactionApiId = await bpiService1.createTransaction(
      v4(),
      3,
      createdWorkflowId,
      createdWorkstep1Id,
      createdBpiSubjectAccountBuyerId,
      buyerBpiSubjectEddsaPrivateKey,
      createdBpiSubjectAccountSupplierId,
      JSON.stringify({
        method: 'GET',
        apiKey: process.env.EFAKTURA_API_KEY,
        headers: {},
        queryParams: {
          invoiceId: process.env.EFAKTURA_INVOICE_ID,
        },
      }),
    );
  });

  it('Creates BPI_TRIGGER on App1 and BPI_WAIT on App2', async () => {
    const bpiWaitId = await bpiService2.createWorkstep(
      'wait-step',
      createdWorkgroupId2,
      {
        type: WorkstepType.BPI_WAIT,
        executionParams: {},
      } as any,
    );

    const bpiTriggerId = await bpiService1.createWorkstep(
      'trigger-step',
      createdWorkgroupId,
      {
        type: WorkstepType.BPI_TRIGGER,
        executionParams: {},
      } as any,
    );

    // workflows
    const createdWorkflowId = await bpiService1.createWorkflow(
      'workflow1',
      createdWorkgroupId,
      [bpiTriggerId],
      [createdBpiSubjectAccountSupplierId, createdBpiSubjectAccountBuyerId],
    );

    const createdWorkflowId2 = await bpiService2.createWorkflow(
      'workflow1',
      createdWorkgroupId2,
      [bpiWaitId],
      [createdBpiSubjectAccountSupplierId2, createdBpiSubjectAccountBuyerId2],
    );

    const content = { test: 'test content' };
    const signature = await createEddsaSignature(
      JSON.stringify(content),
      buyerBpiSubjectEddsaPrivateKey,
    );

    const txId2 = v4();
    const txid = await bpiService1.createTransaction(
      v4(),
      4,
      createdWorkflowId,
      bpiTriggerId,
      createdBpiSubjectAccountBuyerId,
      buyerBpiSubjectEddsaPrivateKey,
      createdBpiSubjectAccountSupplierId,
      JSON.stringify({
        id: txId2,
        nonce: 5,
        fromBpiSubjectId: createdBpiSubjectBuyerId2,
        toBpiSubjectId: createdBpiSubjectAccountSupplierId2,
        content,
        signature,
        type: 1,
        fromBpiSubjectAccountId: createdBpiSubjectAccountBuyerId2,
        toBpiSubjectAccountId: createdBpiSubjectAccountSupplierId2,
        workflowId: createdWorkflowId2,
        workstepId: bpiWaitId,
      }),
    );

    // wait and check both txs are created
    await new Promise((r) => setTimeout(r, 5000));

    await bpiService1.fetchTransaction(txid);

    await new Promise((r) => setTimeout(r, 5000));

    await bpiService2.fetchTransaction(txId2);
  });
});
