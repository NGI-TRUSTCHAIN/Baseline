import { ethers } from 'ethers';
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

  describe.skip('Serbia BPI service', () => {
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

    it('Sets up a workflow with a two worksteps for validating supplier provided invoice and triggering efakture API in the previously created workgroup', async () => {
      createdWorkstep1Id = await bpiService1.createWorkstep(
        'workstep1',
        createdWorkgroupId,
        {
          type: WorkstepType.PAYLOAD_FROM_USER,
          executionParams: {
            verifierContractAddress: 'TODO',
          },
          payloadFormatType: PayloadFormatType.XML,
        },
      );

      createdWorkstep2Id = await bpiService1.createWorkstep(
        'workstep2',
        createdWorkgroupId,
        {
          type: WorkstepType.PAYLOAD_FROM_API,
          executionParams: {
            verifierContractAddress: 'TODO',
            apiUrl: process.env.EFAKTURA_URL,
          },
          payloadFormatType: PayloadFormatType.XML,
        },
      );

      createdWorkflowId = await bpiService1.createWorkflow(
        'workflow1',
        createdWorkgroupId,
        [createdWorkstep1Id, createdWorkstep2Id],
        [createdBpiSubjectAccountSupplierId, createdBpiSubjectAccountBuyerId],
      );
    });

    it('Add a circuit input translation schema to workstep 1', async () => {
      const schema = `{
                        "mapping": [],
                        "extractions": [
                            {
                                "field": "ds:Signature.ds:SignatureValue._",
                                "destinationPath": "supplierSignature",
                                "circuitInput": "supplierSignature",
                                "description": "Signature on the document",
                                "dataType": "string",
                                "checkType": "signatureCheck"
                            }
                        ]
                    }`;
      await bpiService1.addCircuitInputsSchema(createdWorkstep1Id, schema);
    });

    it('Submits transaction for execution of the workstep 1', async () => {
      createdTransactionApiId = await bpiService1.createTransaction(
        v4(),
        3,
        createdWorkflowId,
        createdWorkstep1Id,
        createdBpiSubjectAccountBuyerId,
        buyerBpiSubjectEddsaPrivateKey,
        createdBpiSubjectAccountSupplierId,
        `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
      <root>
        <SupplierSEFApiKey>3f035060-159f-4f4b-97c0-2a5bbbc3464f</SupplierSEFApiKey>
        <SupplierSEFSalesInvoiceId>304524665</SupplierSEFSalesInvoiceId>
        <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="id-b305a4b5c77fdf500e527f4152dbed7a"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><ds:Reference Id="r-id-b305a4b5c77fdf500e527f4152dbed7a-1" URI=""><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2002/06/xmldsig-filter2"><dsig-filter2:XPath xmlns:dsig-filter2="http://www.w3.org/2002/06/xmldsig-filter2" Filter="subtract">/descendant::ds:Signature</dsig-filter2:XPath></ds:Transform><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>r6P92Dxnub2RNEhnMx2vBUe4ztsb54y23njIHdgZO4A=</ds:DigestValue></ds:Reference><ds:Reference Type="http://uri.etsi.org/01903#SignedProperties" URI="#xades-id-b305a4b5c77fdf500e527f4152dbed7a"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>2spAJ3xkrk6GXSsZzp7BvjL33ykffBDq1R4VrWIFzvE=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue Id="value-id-b305a4b5c77fdf500e527f4152dbed7a">AXVRJsw8fRkK+nArpQelG7oCMcN7JJVrLE7eJ09riTF53ZXxPJqZMhVNM/deCck39oC3ucqzRlh8dpkWdhYG8Ezf4LXOJsafLTSLoVGcBjggj86d7STCLEX7d//iRv5m5286xabWpl5HRgp+rbO5rq6BCpULlPA4JaD3JUs4PNbmD4ZtCJZNHMAVe5ouoc9jiZZm7oLNSL7q73BBC/pwmHj3L3oFXJQWVAuimbWttxDS/wEEWJ+ExwScIucbLivZzac9HNnESNOQ7g5J7DrngwZbv5QWF1R48Uvd+FlxPgqdC5GHbMQAmYNRt9Nd+MbSydEZiRoajrrJrgSpc2qIkQ==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>MIIHTTCCBTWgAwIBAgIJGV8lgFsu1MX0MA0GCSqGSIb3DQEBDQUAMIG3MQswCQYDVQQGEwJSUzEQMA4GA1UEBwwHQmVvZ3JhZDEYMBYGA1UEYQwPVkFUUlMtMTAwMTg0MTE2MSMwIQYDVQQLDBpTZXJ0aWZpa2FjaW9ubyB0ZWxvIE1VUCBSUzE7MDkGA1UECgwyTWluaXN0YXJzdHZvIHVudXRyYcWhbmppaCBwb3Nsb3ZhIFJlcHVibGlrZSBTcmJpamUxGjAYBgNVBAMMEU1VUCBHcmFkamFuaSBDQSA0MB4XDTIzMTAxMTE3MDEyN1oXDTI4MTAxMTE3MDEyN1owgbYxCzAJBgNVBAYTAlJTMRgwFgYDVQQFEw9DQTpSUy0wMTI5NjE0NjExHDAaBgNVBAUTE1BOT1JTLTA3MDc5OTQ3ODAwMzAxHzAdBgNVBAQMFtCc0JjQm9Ce0JLQkNCd0J7QktCY0IsxEzARBgNVBCoMCtCI0J7QktCQ0J0xOTA3BgNVBAMMMNCI0J7QktCQ0J0g0JzQmNCb0J7QktCQ0J3QntCS0JjQiyAwMTI5NjE0NjEgU2lnbjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAMVekU4MT11dg+txVdFRmh/jAXm31GSuZnNbRupkrHztqWfrQknFfnOcRzWq7eYfa1j9h6tAYD7HkD8csM9ddvIrFRwtGtTHt1AqeOBVWIwnsLmVLxGsiJb6zjhxQ+F9VeZIEPAM70y5g2pb9/JEIe+7NsER5pjsT1BHlwgrDl1bycMoQudhrdo9rXsrZgGj/ewiqPcex43jaxlKVJgN/ppX7qKuPJ2rImEPmInKC5/9ymwuhs0pY7vUvtUF6RuBCmDxIqGBPeoqYfs6+/D8Qq2vwb6r9qtNJNCIgXMM0JCjTeImzuqR2WYCyhHs1f+mBzeeqru+ifNGggz1NtVZ2SECAwEAAaOCAlkwggJVMAkGA1UdEwQCMAAwDgYDVR0PAQH/BAQDAgbAMB8GA1UdIwQYMBaAFAGFXe/ZpvYhcAOvkdKhsjz3kx/hMB0GA1UdDgQWBBRK/VLljNS9zTgxKUpVsUA41ZMQ8TA4BgNVHR8EMTAvMC2gK6AphidodHRwOi8vY2EubXVwLmdvdi5ycy9NVVBHcmFkamFuaUNBNC5jcmwwdQYIKwYBBQUHAQMBAf8EZjBkMDkGCCsGAQUFBwsCMC0GBwQAi+xJAQEwIoYgaHR0cDovL2NhLm11cC5nb3YucnMvTVVQX0NQUy5wZGYwCAYGBACORgEBMAgGBgQAjkYBBDATBgYEAI5GAQYwCQYHBACORgEGATB5BggrBgEFBQcBAQRtMGswMwYIKwYBBQUHMAKGJ2h0dHA6Ly9jYS5tdXAuZ292LnJzL01VUEdyYWRqYW5pQ0E0LmNydDA0BggrBgEFBQcwAYYoaHR0cDovL29jc3AubXVwLmdvdi5ycy9NVVBHcmFkamFuaUNBb2NzcDCBywYDVR0gBIHDMIHAMDgGBwQAi+xAAQIwLTArBggrBgEFBQcCARYfaHR0cDovL2NhLm11cC5nb3YucnMvTVVQX0NQLnBkZjCBgwYLKwYBBAGChjUBAQAwdDAsBggrBgEFBQcCARYgaHR0cDovL2NhLm11cC5nb3YucnMvTVVQX0NQUy5wZGYwRAYIKwYBBQUHAgIwOAw2T3ZvIGplIGt2YWxpZmlrb3Zhbmkgc2VydGlmaWthdCB6YSBlbGVrdHJvbnNraSBwb3RwaXMuMA0GCSqGSIb3DQEBDQUAA4ICAQCckfAxiu22wMaH116BB4xeWRFWbzLthV+Fzv55gHKin9FbBP6c5aqmtGUTE96imC467EdjfUnnU8uBty8gYuLlOIDJBMNon0qGIGBdFPfxhy6hRLjTkdYWekwn+d5x8WZ/Cq/pe5im5aCfYYriXe+48gaum8Jg+2nQU3l59x1zqjMkhnbKNPZjk91gpGyyTAUF1JmLrDjf5jPwfJeyse68U90U6lKSOYZVg7sEs0i6cumvJKDu2JASnz5FMVHgtCyjYuxSwuiQ+7M//n7HYTRN2Jvy4oLSoCUxRuZ8IIrxr++NOlXyB4Scib5yS1H6cN82GLaZ95b9AUUKCWAxWSN06m4hpJvIqyuAECiCqytGbvRUGhWCMOdENrqgZOax5pJhst45Bh4HUUyqM1vaVJIug8aiX8GeSw4ABRJoi5v+E2VFaV4cldiDb701HaLsw/+MpbirgHPdR3kh/D1fridcTFYmKAJekSNErIs0WzOyomWeV1BExw1M4BDivxuIYJ/1Z7pRwXWJ9b5FTmo1sC3liTDeZEUMwejCVFS2xJX0u0IwCxQ5OsOZraY6mmHD9p+gQNJSlD1yESdkMftQnf444EbC5e0yalxnHXBN5uJ6bpYVHAaFnr3p/W5l0NabGL9h7PXy0hqZlE6K8QBUpCM1dIi0qzZyzbVYQVIQYOdyRw==</ds:X509Certificate></ds:X509Data></ds:KeyInfo><ds:Object><xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="#id-b305a4b5c77fdf500e527f4152dbed7a"><xades:SignedProperties Id="xades-id-b305a4b5c77fdf500e527f4152dbed7a"><xades:SignedSignatureProperties><xades:SigningTime>2025-05-27T12:51:46Z</xades:SigningTime><xades:SigningCertificateV2><xades:Cert><xades:CertDigest><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha512"/><ds:DigestValue>svyY+9uIAykU58BEHrO9jp8wZYlYXoCUgnjOJu/Sfi8gJUpn8tbbIdIGiXUhKyfMBFS1qk2kLF4j0+HnN8ISEg==</ds:DigestValue></xades:CertDigest><xades:IssuerSerialV2>MIHLMIG9pIG6MIG3MQswCQYDVQQGEwJSUzEQMA4GA1UEBwwHQmVvZ3JhZDEYMBYGA1UEYQwPVkFUUlMtMTAwMTg0MTE2MSMwIQYDVQQLDBpTZXJ0aWZpa2FjaW9ubyB0ZWxvIE1VUCBSUzE7MDkGA1UECgwyTWluaXN0YXJzdHZvIHVudXRyYcWhbmppaCBwb3Nsb3ZhIFJlcHVibGlrZSBTcmJpamUxGjAYBgNVBAMMEU1VUCBHcmFkamFuaSBDQSA0AgkZXyWAWy7UxfQ=</xades:IssuerSerialV2></xades:Cert></xades:SigningCertificateV2></xades:SignedSignatureProperties><xades:SignedDataObjectProperties><xades:DataObjectFormat ObjectReference="#r-id-b305a4b5c77fdf500e527f4152dbed7a-1"><xades:MimeType>text/xml</xades:MimeType></xades:DataObjectFormat></xades:SignedDataObjectProperties></xades:SignedProperties><xades:UnsignedProperties><xades:UnsignedSignatureProperties><xades:SignatureTimeStamp Id="ts-id-04d21e784ca323aa4110b613146117357fc9535f"><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><xades:EncapsulatedTimeStamp Id="ets-id-04d21e784ca323aa4110b613146117357fc9535f">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</xades:EncapsulatedTimeStamp></xades:SignatureTimeStamp></xades:UnsignedSignatureProperties></xades:UnsignedProperties></xades:QualifyingProperties></ds:Object></ds:Signature>
      </root>`,
      );
    });

    it('Waits for a single VSM cycle and then verifies that the transaction 4 has been executed', async () => {
      // TODO
      // await new Promise((r) => setTimeout(r, 50000));
      // const resultWorkflow = await fetchWorkflow(createdWorkflowId);
      // const resultBpiAccount = await fetchBpiAccount(resultWorkflow.bpiAccountId);
      // const stateBpiMerkleTree = new BpiMerkleTree(
      //   'ttt',
      //   'sha256',
      //   MerkleTree.unmarshalTree(
      //     resultBpiAccount.stateTree.tree,
      //     new MerkleTreeService().createHashFunction('sha256'),
      //   ),
      // );
      // const historyBpiMerkleTree = new BpiMerkleTree(
      //   'ttt',
      //   'sha256',
      //   MerkleTree.unmarshalTree(
      //     resultBpiAccount.historyTree.tree,
      //     new MerkleTreeService().createHashFunction('sha256'),
      //   ),
      // );
      // expect(
      //   historyBpiMerkleTree.getLeafIndex(stateBpiMerkleTree.getRoot()),
      // ).toBe(0);
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
                        "mapping": [],
                        "extractions": [
                            {
                                "field": "supplier.signature_base64",
                                "destinationPath": "supplierSignature",
                                "circuitInput": "supplierSignature",
                                "description": "Supplier signature on the document",
                                "dataType": "string",
                                "checkType": "signatureCheck"
                            },
                            {
                                "field": "buyer.signature_base64",
                                "destinationPath": "buyerSignature",
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
      createdTransactionApiId = await bpiService2.createTransaction(
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
    });
  });
});

async function waitForTreeUpdate(
  bpiService2,
  bpiAccountId,
  maxTries = 10,
  delay = 20000,
) {
  for (let i = 0; i < maxTries; i++) {
    const result = await bpiService2.fetchBpiAccount(bpiAccountId);
    const tree = JSON.parse(result?.stateTree?.tree);
    const leaves = tree?.leaves;

    const hasLeaves = Array.isArray(leaves) && leaves.length > 0;
    if (hasLeaves) {
      console.log('Leaves detected, returning result.');
      return result;
    }

    console.log(`[Retry ${i + 1}] Tree not yet updated. Waiting ${delay}ms...`);
    await new Promise((r) => setTimeout(r, delay));
  }

  throw new Error('State tree was not updated after maximum retries');
}
