import express from 'express';
import { Request, Response, RequestHandler } from 'express';
import { Server } from 'http';

export class EFakturaMockServer {
  private app: express.Application;
  private server!: Server; // Use definite assignment assertion
  private port: number;

  constructor(port = 3001) {
    this.app = express();
    this.port = port;
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, '0.0.0.0', () => {
        console.log(`Mock eFaktura server running on port ${this.port}`);
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public setupRoutes() {
    const handleInvoiceRequest: RequestHandler = (
      req: Request,
      res: Response,
    ) => {
      const apiKey = req.headers.apikey;
      const invoiceId = req.query.invoiceId;

      if (apiKey !== 'd2e7f81c-64c7-4c61-9b43-b6d215d9a2cf') {
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }

      if (!invoiceId) {
        res.status(400).json({ error: 'Missing invoiceId parameter' });
        return;
      }

      res.set({
        'content-type': 'application/xml; charset=utf-8',
        'content-disposition': 'attachment; filename="invoice.xml"',
      });

      // Return mock XML response
      const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<env:DocumentEnvelope xmlns:env="urn:eFaktura:MinFinrs:envelop:schema">
  <env:DocumentHeader>
    <env:SalesInvoiceId>999999999</env:SalesInvoiceId>
    <env:PurchaseInvoiceId>888888888</env:PurchaseInvoiceId>
    <env:DocumentId>abcde123-ffff-4aaa-8888-abcdefabcdef</env:DocumentId>
    <env:CreationDate>2025-05-07</env:CreationDate>
    <env:SendingDate>2025-05-07</env:SendingDate>
    <env:DocumentPdf mimeCode="application/pdf"></env:DocumentPdf>
  </env:DocumentHeader>
  <env:DocumentBody>
    <Invoice xmlns:cec="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:sbt="http://mfin.gov.rs/srbdt/srbdtext" xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
      <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:mfin.gov.rs:srbdt:2021</cbc:CustomizationID>
      <cbc:ID>FOO/2025/01</cbc:ID>
      <cbc:IssueDate>2025-05-07</cbc:IssueDate>
      <cbc:DueDate>2025-06-05</cbc:DueDate>
      <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
      <cbc:DocumentCurrencyCode>RSD</cbc:DocumentCurrencyCode>
      <cac:InvoicePeriod>
        <cbc:DescriptionCode>35</cbc:DescriptionCode>
      </cac:InvoicePeriod>
      <cac:OrderReference />
      <cac:DespatchDocumentReference>
        <cbc:ID>FOO/2025/01</cbc:ID>
        <cbc:IssueDate>2025-05-06</cbc:IssueDate>
      </cac:DespatchDocumentReference>
      <cac:OriginatorDocumentReference />
      <cac:OriginatorDocumentReference />
      <cac:ContractDocumentReference />
      <cac:AdditionalDocumentReference>
        <cbc:ID>FOO</cbc:ID>
        <cac:Attachment>
          <cbc:EmbeddedDocumentBinaryObject mimeCode="application/pdf"></cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
      </cac:AdditionalDocumentReference>
      <cac:AccountingSupplierParty>
        <cac:Party>
          <cbc:EndpointID schemeID="9948">999999999</cbc:EndpointID>
          <cac:PartyIdentification />
          <cac:PartyName>
            <cbc:Name>FOO LLC</cbc:Name>
          </cac:PartyName>
          <cac:PostalAddress>
            <cbc:StreetName>123 FOO Street</cbc:StreetName>
            <cbc:CityName>FOOTOWN</cbc:CityName>
            <cac:Country>
              <cbc:IdentificationCode>XX</cbc:IdentificationCode>
            </cac:Country>
          </cac:PostalAddress>
          <cac:PartyTaxScheme>
            <cbc:CompanyID>XX999999999</cbc:CompanyID>
            <cac:TaxScheme>
              <cbc:ID>VAT</cbc:ID>
            </cac:TaxScheme>
          </cac:PartyTaxScheme>
          <cac:PartyLegalEntity>
            <cbc:RegistrationName>FOO LLC</cbc:RegistrationName>
            <cbc:CompanyID>12345678</cbc:CompanyID>
          </cac:PartyLegalEntity>
        </cac:Party>
      </cac:AccountingSupplierParty>
      <cac:AccountingCustomerParty>
        <cac:Party>
          <cbc:EndpointID schemeID="9948">888888888</cbc:EndpointID>
          <cac:PartyIdentification>
            <cbc:ID>87654321</cbc:ID>
          </cac:PartyIdentification>
          <cac:PartyName>
            <cbc:Name>BAR Inc.</cbc:Name>
          </cac:PartyName>
          <cac:PostalAddress>
            <cbc:StreetName>456 BAR Avenue</cbc:StreetName>
            <cbc:CityName>BARVILLE</cbc:CityName>
            <cbc:PostalZone>99999</cbc:PostalZone>
            <cac:Country>
              <cbc:IdentificationCode>YY</cbc:IdentificationCode>
            </cac:Country>
          </cac:PostalAddress>
          <cac:PartyTaxScheme>
            <cbc:CompanyID>YY888888888</cbc:CompanyID>
            <cac:TaxScheme>
              <cbc:ID>VAT</cbc:ID>
            </cac:TaxScheme>
          </cac:PartyTaxScheme>
          <cac:PartyLegalEntity>
            <cbc:RegistrationName>BAR Inc.</cbc:RegistrationName>
            <cbc:CompanyID>87654321</cbc:CompanyID>
          </cac:PartyLegalEntity>
        </cac:Party>
      </cac:AccountingCustomerParty>
      <cac:Delivery>
        <cbc:ActualDeliveryDate>2025-05-06</cbc:ActualDeliveryDate>
        <cac:DeliveryParty>
          <cac:PartyName>
            <cbc:Name>BAR Inc.</cbc:Name>
          </cac:PartyName>
        </cac:DeliveryParty>
      </cac:Delivery>
      <cac:PaymentMeans>
        <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
        <cbc:PaymentID>FOO/2025/01</cbc:PaymentID>
        <cac:PayeeFinancialAccount>
          <cbc:ID>000-000000-00 | 111-11111111111-11</cbc:ID>
        </cac:PayeeFinancialAccount>
      </cac:PaymentMeans>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="RSD">999.99</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="RSD">4999.99</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="RSD">999.99</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:ID>S</cbc:ID>
            <cbc:Percent>20.00</cbc:Percent>
            <cac:TaxScheme>
              <cbc:ID>VAT</cbc:ID>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>
      <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="RSD">4999.99</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="RSD">4999.99</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="RSD">5999.98</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="RSD">0.00</cbc:AllowanceTotalAmount>
        <cbc:PrepaidAmount currencyID="RSD">0</cbc:PrepaidAmount>
        <cbc:PayableAmount currencyID="RSD">5999.98</cbc:PayableAmount>
      </cac:LegalMonetaryTotal>
      <cac:InvoiceLine>
        <cbc:ID>99999</cbc:ID>
        <cbc:InvoicedQuantity unitCode="H87" unitCodeListID="H87">1000</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="RSD">4999.99</cbc:LineExtensionAmount>
        <cac:AllowanceCharge>
          <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
          <cbc:MultiplierFactorNumeric>0.00</cbc:MultiplierFactorNumeric>
          <cbc:Amount currencyID="RSD">0.00</cbc:Amount>
        </cac:AllowanceCharge>
        <cac:Item>
          <cbc:Description>FOO PRODUCT XYZ 1000ml /1000</cbc:Description>
          <cbc:Name>FOO PRODUCT XYZ 1000ml /1000</cbc:Name>
          <cac:SellersItemIdentification>
            <cbc:ID>XYZ-1000</cbc:ID>
          </cac:SellersItemIdentification>
          <cac:StandardItemIdentification />
          <cac:CatalogueItemIdentification />
          <cac:ClassifiedTaxCategory>
            <cbc:ID>S</cbc:ID>
            <cbc:Percent>20</cbc:Percent>
            <cac:TaxScheme>
              <cbc:ID>VAT</cbc:ID>
            </cac:TaxScheme>
          </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
          <cbc:PriceAmount currencyID="RSD">5.00</cbc:PriceAmount>
        </cac:Price>
      </cac:InvoiceLine>
    </Invoice>
  </env:DocumentBody>
</env:DocumentEnvelope>
`;

      res.send(mockXml);
    };

    this.app.get('/api/publicApi/sales-invoice/xml', handleInvoiceRequest);
    this.app.get('/api/health', (_req: Request, res: Response) => {
      res.status(200).json({ status: 'ok' });
    });
  }
}
