import { ethers } from 'ethers';
import { ApiClient } from './apiClient';
import { createEddsaSignature } from '../../src/shared/testing/utils';
import { WorkstepConfig } from '../../src/bri/workgroup/worksteps/models/workstep';

export class BpiService {
  constructor(private readonly apiClient: ApiClient) {}

  async loginAsInternalBpiSubject(
    publicKey: string,
    privateKey: string,
  ): Promise<string> {
    const nonceResponse = await this.apiClient.post('/auth/nonce', {
      publicKey,
    });
    const signer = new ethers.Wallet(privateKey);
    const signature = await signer.signMessage(nonceResponse);

    const loginResponseText = await this.apiClient.post('/auth/login', {
      message: nonceResponse,
      signature,
      publicKey,
    });
    const loginResponse = JSON.parse(loginResponseText);

    return loginResponse.access_token;
  }

  async createExternalBpiSubject(
    name: string,
    publicKeys: { type: string; value: string }[],
  ): Promise<string> {
    return this.apiClient.post('/subjects', {
      name,
      desc: 'A test Bpi Subject',
      publicKeys,
    });
  }

  async createBpiSubjectAccount(
    creatorId: string,
    ownerId: string,
  ): Promise<string> {
    return this.apiClient.post('/subjectAccounts', {
      creatorBpiSubjectId: creatorId,
      ownerBpiSubjectId: ownerId,
    });
  }

  async createWorkgroup(): Promise<string> {
    return this.apiClient.post('/workgroups', {
      name: 'Test workgroup',
      securityPolicy: 'Dummy security policy',
      privacyPolicy: 'Dummy privacy policy',
    });
  }

  async updateWorkgroup(
    workgroupId: string,
    adminIds: string[],
    participantIds: string[],
  ): Promise<void> {
    await this.apiClient.put(`/workgroups/${workgroupId}`, {
      name: 'Test workgroup',
      administratorIds: adminIds,
      securityPolicy: 'Dummy security policy',
      privacyPolicy: 'Dummy privacy policy',
      participantIds,
    });
  }

  async fetchWorkgroup(workgroupId: string): Promise<any> {
    return this.apiClient.get(`/workgroups/${workgroupId}`);
  }

  async createWorkstep(
    name: string,
    workgroupId: string,
    workstepConfig: WorkstepConfig,
  ): Promise<string> {
    return this.apiClient.post('/worksteps', {
      name,
      version: '1',
      status: 'NEW',
      workgroupId,
      securityPolicy: 'Dummy security policy',
      privacyPolicy: 'Dummy privacy policy',
      workstepConfig,
    });
  }

  async addCircuitInputsSchema(
    workstepId: string,
    schema: string,
  ): Promise<string> {
    const response = await this.apiClient.put<{ id: string }>(
      `/worksteps/${workstepId}/circuitinputsschema`,
      {
        schema,
      },
    );
    return response.id;
  }

  async createWorkflow(
    name: string,
    workgroupId: string,
    workstepIds: string[],
    ownerIds: string[],
  ): Promise<string> {
    return this.apiClient.post('/workflows', {
      name,
      workgroupId,
      workstepIds,
      workflowBpiAccountSubjectAccountOwnersIds: ownerIds,
    });
  }

  async fetchWorkflow(workflowId: string): Promise<any> {
    return this.apiClient.get(`/workflows/${workflowId}`);
  }

  async fetchBpiAccount(bpiAccountId: string): Promise<any> {
    return this.apiClient.get(`/accounts/${bpiAccountId}`);
  }

  async createTransaction(
    id: string,
    nonce: number,
    workflowId: string,
    workstepId: string,
    fromSubjectAccountId: string,
    fromPrivateKey: string,
    toSubjectAccountId: string,
    payload: string,
  ): Promise<string> {
    const signature = await createEddsaSignature(payload, fromPrivateKey);
    return this.apiClient.post('/transactions', {
      id,
      nonce,
      workflowId,
      workstepId,
      fromSubjectAccountId,
      toSubjectAccountId,
      payload,
      signature,
    });
  }

  async fetchTransaction(txId: string): Promise<any> {
    return this.apiClient.get(`/transactions/${txId}`);
  }

  async fetchStateTreeLeafViaCAH(cah: string): Promise<any> {
    return this.apiClient.get('/state', { leafValue: cah });
  }
}
