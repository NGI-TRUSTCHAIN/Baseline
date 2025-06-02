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
const server = 'http://localhost:3000';
const server2 = 'http://localhost:3001';

let supplierBpiSubjectEddsaPublicKey: string;
let supplierBpiSubjectEddsaPrivateKey: string;
let buyerBpiSubjectEddsaPublicKey: string;
let buyerBpiSubjectEddsaPrivateKey: string;
let createdWorkgroupId: string;
let createdWorkstep1Id: string;
let createdWorkflowId: string;
let createdBpiSubjectAccountSupplierId: string;
let createdBpiSubjectAccountBuyerId: string;
let createdTransactionApiId: string;

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

    const createdBpiSubjectSupplierId =
      await createExternalBpiSubjectAndReturnId(
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

    const createdBpiSubjectBuyerId = await createExternalBpiSubjectAndReturnId(
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

    createdWorkgroupId = await createAWorkgroupAndReturnId();

    await updateWorkgroupAdminsAndParticipants(
      createdWorkgroupId,
      [createdBpiSubjectSupplierId],
      [createdBpiSubjectSupplierId, createdBpiSubjectBuyerId],
    );

    const resultWorkgroup = await fetchWorkgroup(createdWorkgroupId);
    expect(resultWorkgroup.participants.length).toBe(2);
    expect(resultWorkgroup.participants[0].id).toEqual(
      createdBpiSubjectSupplierId,
    );
    expect(resultWorkgroup.participants[1].id).toEqual(
      createdBpiSubjectBuyerId,
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

  it('Waits for a single VSM cycle and then verifies that the transaction 4 has been executed', async () => {
    await new Promise((r) => setTimeout(r, 50000));

    // TODO add checks
  });
});

async function loginAsInternalBpiSubjectAndReturnAnAccessToken(): Promise<string> {
  const nonceResponse = await request(server)
    .post('/auth/nonce')
    .send({ publicKey: internalBpiSubjectEcdsaPublicKey })
    .expect(201);

  const signer = new ethers.Wallet(internalBpiSubjectEcdsaPrivateKey);
  const signature = await signer.signMessage(nonceResponse.text);

  const loginResponse = await request(server)
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
): Promise<string> {
  const createdBpiSubjectResponse = await request(server)
    .post('/subjects')
    .set('Authorization', `Bearer ${accessToken}`)
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
): Promise<string> {
  const createdBpiSubjectAccountResponse = await request(server)
    .post('/subjectAccounts')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      creatorBpiSubjectId: creatorBpiSubjectId,
      ownerBpiSubjectId: ownerBpiSubjectId,
    })
    .expect(201);

  return createdBpiSubjectAccountResponse.text;
}

async function createAWorkgroupAndReturnId(): Promise<string> {
  const createdWorkgroupResponse = await request(server)
    .post('/workgroups')
    .set('Authorization', `Bearer ${accessToken}`)
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
): Promise<void> {
  await request(server)
    .put(`/workgroups/${workgroupId}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      name: 'Test workgroup',
      administratorIds: administratorIds,
      securityPolicy: 'Dummy security policy',
      privacyPolicy: 'Dummy privacy policy',
      participantIds: participantIds,
    })
    .expect(200);
}

async function fetchWorkgroup(workgroupId: string): Promise<any> {
  const getWorkgroupResponse = await request(server)
    .get(`/workgroups/${workgroupId}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  return JSON.parse(getWorkgroupResponse.text);
}

async function createWorkstepAndReturnId(
  name: string,
  workgroupId: string,
  workstepConfig: WorkstepConfig,
): Promise<string> {
  const createdWorkstepResponse = await request(server)
    .post('/worksteps')
    .set('Authorization', `Bearer ${accessToken}`)
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
): Promise<string> {
  const createdWorkflowResponse = await request(server)
    .post('/workflows')
    .set('Authorization', `Bearer ${accessToken}`)
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
