import { ethers } from 'ethers';
import * as request from 'supertest';
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
  WorkstepConfig,
  WorkstepType,
} from '../src/bri/workgroup/worksteps/models/workstep';

jest.setTimeout(240000);

let accessToken: string;
let accessToken2: string;
const server = 'http://localhost:3000';
const server2 = 'http://localhost:3001';

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
  });

  it('Logs in an internal Bpi Subject, creates two external Bpi Subjects (Supplier and Buyer) and a Workgroup and adds the created Bpi Subjects as participants to the Workgroup', async () => {
    accessToken = await loginAsInternalBpiSubjectAndReturnAnAccessToken();
    console.log('AT1', accessToken);
    accessToken2 =
      await loginAsInternalBpiSubjectAndReturnAnAccessToken(server2);
    console.log('AT2', accessToken2);

    // bpi1
    createdBpiSubjectSupplierId = await createExternalBpiSubjectAndReturnId(
      'External Bpi Subject - Supplier',
      [
        { type: 'ecdsa', value: supplierBpiSubjectEcdsaPublicKey },
        { type: 'eddsa', value: supplierBpiSubjectEddsaPublicKey },
      ],
    );

    createdBpiSubjectAccountSupplierId =
      await createBpiSubjectAccountAndReturnId(
        createdBpiSubjectSupplierId,
        createdBpiSubjectSupplierId,
      );

    createdBpiSubjectBuyerId = await createExternalBpiSubjectAndReturnId(
      'External Bpi Subject 2 - Buyer',
      [
        { type: 'ecdsa', value: buyerBpiSubjectEcdsaPublicKey },
        { type: 'eddsa', value: buyerBpiSubjectEddsaPublicKey },
      ],
    );

    createdBpiSubjectAccountBuyerId = await createBpiSubjectAccountAndReturnId(
      createdBpiSubjectBuyerId,
      createdBpiSubjectBuyerId,
    );

    // bpi2
    createdBpiSubjectSupplierId2 = await createExternalBpiSubjectAndReturnId(
      'External Bpi Subject - Supplier',
      [
        { type: 'ecdsa', value: supplierBpiSubjectEcdsaPublicKey },
        { type: 'eddsa', value: supplierBpiSubjectEddsaPublicKey },
      ],
      server2,
      accessToken2,
    );

    createdBpiSubjectAccountSupplierId2 =
      await createBpiSubjectAccountAndReturnId(
        createdBpiSubjectSupplierId2,
        createdBpiSubjectSupplierId2,
        server2,
        accessToken2,
      );

    createdBpiSubjectBuyerId2 = await createExternalBpiSubjectAndReturnId(
      'External Bpi Subject 2 - Buyer',
      [
        { type: 'ecdsa', value: buyerBpiSubjectEcdsaPublicKey },
        { type: 'eddsa', value: buyerBpiSubjectEddsaPublicKey },
      ],
      server2,
      accessToken2,
    );

    createdBpiSubjectAccountBuyerId2 = await createBpiSubjectAccountAndReturnId(
      createdBpiSubjectBuyerId2,
      createdBpiSubjectBuyerId2,
      server2,
      accessToken2,
    );

    // workgroup on bpi1
    createdWorkgroupId = await createAWorkgroupAndReturnId();

    await updateWorkgroupAdminsAndParticipants(
      createdWorkgroupId,
      [createdBpiSubjectSupplierId],
      [createdBpiSubjectSupplierId, createdBpiSubjectBuyerId],
    );

    console.log('WG 1', createdWorkgroupId);
    const resultWorkgroup = await fetchWorkgroup(createdWorkgroupId);
    expect(resultWorkgroup.participants.length).toBe(2);
    expect(resultWorkgroup.participants[0].id).toEqual(
      createdBpiSubjectSupplierId,
    );
    expect(resultWorkgroup.participants[1].id).toEqual(
      createdBpiSubjectBuyerId,
    );

    // workgroup on bpi2
    createdWorkgroupId2 = await createAWorkgroupAndReturnId(
      server2,
      accessToken2,
    );
    console.log('WG 2', createdWorkgroupId2);

    await updateWorkgroupAdminsAndParticipants(
      createdWorkgroupId2,
      [createdBpiSubjectSupplierId2],
      [createdBpiSubjectSupplierId2, createdBpiSubjectBuyerId2],
      server2,
      accessToken2,
    );

    const resultWorkgroup2 = await fetchWorkgroup(
      createdWorkgroupId2,
      server2,
      accessToken2,
    );
    expect(resultWorkgroup2.participants.length).toBe(2);
    expect(resultWorkgroup2.participants[0].id).toEqual(
      createdBpiSubjectSupplierId2,
    );
    expect(resultWorkgroup2.participants[1].id).toEqual(
      createdBpiSubjectBuyerId2,
    );
  });

  it('Sets up a workflow with a single workstep for triggering efakture API in the previously created workgroup', async () => {
    createdWorkstep1Id = await createWorkstepAndReturnId(
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

    createdWorkflowId = await createWorkflowAndReturnId(
      'workflow1',
      createdWorkgroupId,
      [createdWorkstep1Id],
      [createdBpiSubjectAccountSupplierId, createdBpiSubjectAccountBuyerId],
    );
  });

  // TODO
  // it('Add a circuit input translation schema to workstep 1', async () => {
  //   const schema = `{
  //         "mapping": [
  //           {
  //             "circuitInput": "invoiceStatus",
  //             "description": "Invoice status",
  //             "payloadJsonPath": "status",
  //             "dataType": "string"
  //           },
  //           {
  //             "circuitInput": "invoiceAmount",
  //             "description": "Total gross amount of the invoice",
  //             "payloadJsonPath": "amount",
  //             "dataType": "integer"
  //           },
  //           {
  //             "circuitInput": "itemPrices",
  //             "description": "Invoice item prices",
  //             "payloadJsonPath": "items",
  //             "dataType": "array",
  //             "arrayType": "object",
  //             "arrayItemFieldName": "price",
  //             "arrayItemFieldType": "integer"
  //           },
  //           {
  //             "circuitInput": "itemAmount",
  //             "description": "Invoice item amounts",
  //             "payloadJsonPath": "items",
  //             "dataType": "array",
  //             "arrayType": "object",
  //             "arrayItemFieldName": "amount",
  //             "arrayItemFieldType": "integer"
  //           }
  //         ]
  //       }`;
  //   await addCircuitInputsSchema(createdWorkstep1Id, schema);
  // });

  it('Submits transaction for execution of the workstep 1 with api call', async () => {
    createdTransactionApiId = await createTransactionAndReturnId(
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
    const bpiWaitId = await request(server2)
      .post('/worksteps')
      .set('Authorization', `Bearer ${accessToken2}`)
      .send({
        name: 'wait-step',
        version: '1',
        status: 'NEW',
        workgroupId: createdWorkgroupId2,
        securityPolicy: 'Dummy',
        privacyPolicy: 'Dummy',
        workstepConfig: {
          type: WorkstepType.BPI_WAIT,
          executionParams: {},
        },
      })
      .expect(201);
    console.log('BPI WAIT', bpiWaitId.text);

    const bpiTriggerId = await request(server)
      .post('/worksteps')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'trigger-step',
        version: '1',
        status: 'NEW',
        workgroupId: createdWorkgroupId,
        securityPolicy: 'Dummy security policy',
        privacyPolicy: 'Dummy privacy policy',
        workstepConfig: {
          type: WorkstepType.BPI_TRIGGER,
          executionParams: {},
        },
      })
      .expect(201);
    console.log('BPI TRIGGER', bpiTriggerId.text);

    // workflows
    const createdWorkflowId = await createWorkflowAndReturnId(
      'workflow1',
      createdWorkgroupId,
      [bpiTriggerId.text],
      [createdBpiSubjectAccountSupplierId, createdBpiSubjectAccountBuyerId],
    );

    const createdWorkflowId2 = await createWorkflowAndReturnId(
      'workflow1',
      createdWorkgroupId2,
      [bpiWaitId.text],
      [createdBpiSubjectAccountSupplierId2, createdBpiSubjectAccountBuyerId2],
      server2,
      accessToken2,
    );

    const content = { test: 'test content' };
    const signature = await createEddsaSignature(
      JSON.stringify(content),
      buyerBpiSubjectEddsaPrivateKey,
    );

    const txId2 = v4();
    const txid = await createTransactionAndReturnId(
      v4(),
      4,
      createdWorkflowId,
      bpiTriggerId.text,
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
        workstepId: bpiWaitId.text,
      }),
    );

    console.log('tx id', txid);

    // wait and check both txs are created
    await new Promise((r) => setTimeout(r, 5000));

    const resultTransaction = await fetchTransaction(txid);
    console.log('tx bpi 1', resultTransaction);

    await new Promise((r) => setTimeout(r, 5000));

    const resultTransaction2 = await fetchTransaction(
      txId2,
      server2,
      accessToken2,
    );
    console.log('tx bpi 2', resultTransaction2);
  });

  // it('Waits for a single VSM cycle and then verifies that the transactions on both bpis has been executed', async () => {
  //   await new Promise((r) => setTimeout(r, 5000));

  //   // TODO add checks
  // });
});

async function loginAsInternalBpiSubjectAndReturnAnAccessToken(
  api = server,
): Promise<string> {
  const nonceResponse = await request(api)
    .post('/auth/nonce')
    .send({ publicKey: internalBpiSubjectEcdsaPublicKey })
    .expect(201);

  const signer = new ethers.Wallet(internalBpiSubjectEcdsaPrivateKey);
  const signature = await signer.signMessage(nonceResponse.text);

  const loginResponse = await request(api)
    .post('/auth/login')
    .send({
      message: nonceResponse.text,
      signature,
      publicKey: internalBpiSubjectEcdsaPublicKey,
    })
    .expect(201);

  return JSON.parse(loginResponse.text)['access_token'];
}

async function createExternalBpiSubjectAndReturnId(
  bpiSubjectName: string,
  pk: { type: string; value: string }[],
  api = server,
  token = accessToken,
): Promise<string> {
  const createdBpiSubjectResponse = await request(api)
    .post('/subjects')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: bpiSubjectName,
      desc: 'A test Bpi Subject',
      publicKeys: pk,
    })
    .expect(201);

  return createdBpiSubjectResponse.text;
}

async function createBpiSubjectAccountAndReturnId(
  creatorBpiSubjectId: string,
  ownerBpiSubjectId: string,
  api = server,
  token = accessToken,
): Promise<string> {
  const createdBpiSubjectAccountResponse = await request(api)
    .post('/subjectAccounts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      creatorBpiSubjectId: creatorBpiSubjectId,
      ownerBpiSubjectId: ownerBpiSubjectId,
    })
    .expect(201);

  return createdBpiSubjectAccountResponse.text;
}

async function createAWorkgroupAndReturnId(
  api = server,
  token = accessToken,
): Promise<string> {
  const createdWorkgroupResponse = await request(api)
    .post('/workgroups')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Test workgroup',
      securityPolicy: 'Dummy security policy',
      privacyPolicy: 'Dummy privacy policy',
    })
    .expect(201);

  return createdWorkgroupResponse.text;
}

async function updateWorkgroupAdminsAndParticipants(
  workgroupId: string,
  administratorIds: string[],
  participantIds: string[],
  api = server,
  token = accessToken,
): Promise<void> {
  await request(api)
    .put(`/workgroups/${workgroupId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Test workgroup',
      administratorIds: administratorIds,
      securityPolicy: 'Dummy security policy',
      privacyPolicy: 'Dummy privacy policy',
      participantIds: participantIds,
    })
    .expect(200);
}

async function fetchWorkgroup(
  workgroupId: string,
  api = server,
  token = accessToken,
): Promise<any> {
  const getWorkgroupResponse = await request(api)
    .get(`/workgroups/${workgroupId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  return JSON.parse(getWorkgroupResponse.text);
}

async function createWorkstepAndReturnId(
  name: string,
  workgroupId: string,
  workstepConfig: WorkstepConfig,
  api = server,
  token = accessToken,
): Promise<string> {
  const createdWorkstepResponse = await request(api)
    .post('/worksteps')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: name,
      version: '1',
      status: 'NEW',
      workgroupId: workgroupId,
      securityPolicy: 'Dummy security policy',
      privacyPolicy: 'Dummy privacy policy',
      workstepConfig: workstepConfig,
    })
    .expect(201);

  return createdWorkstepResponse.text;
}

async function addCircuitInputsSchema(
  workstepId: string,
  schema: string,
): Promise<string> {
  const addCircuitInputsSchemaResponse = await request(server)
    .put(`/worksteps/${workstepId}/circuitinputsschema`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      schema: schema,
    })
    .expect(200);

  return addCircuitInputsSchemaResponse.text;
}

async function createWorkflowAndReturnId(
  name: string,
  workgroupId: string,
  workstepIds: string[],
  ownerIds: string[],
  api = server,
  token = accessToken,
): Promise<string> {
  const createdWorkflowResponse = await request(api)
    .post('/workflows')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: name,
      workgroupId: workgroupId,
      workstepIds: workstepIds,
      workflowBpiAccountSubjectAccountOwnersIds: ownerIds,
    })
    .expect(201);

  return createdWorkflowResponse.text;
}

async function createTransactionAndReturnId(
  id: string,
  nonce: number,
  workflowId: string,
  workstepId: string,
  fromSubjectAccountId: string,
  fromPrivatekey: string,
  toSubjectAccountId: string,
  payload: string,
): Promise<string> {
  //Eddsa signature
  const signature = await createEddsaSignature(payload, fromPrivatekey);

  const createdTransactionResponse = await request(server)
    .post('/transactions')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      id: id,
      nonce: nonce,
      workflowId: workflowId,
      workstepId: workstepId,
      fromSubjectAccountId: fromSubjectAccountId,
      toSubjectAccountId: toSubjectAccountId,
      payload: payload,
      signature: signature,
    })
    .expect(201);

  return createdTransactionResponse.text;
}

async function fetchTransaction(
  txId: string,
  api = server,
  token = accessToken,
): Promise<any> {
  const getTransactionResponse = await request(api)
    .get(`/transactions/${txId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  return JSON.parse(getTransactionResponse.text);
}
