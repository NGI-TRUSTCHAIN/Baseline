import { EFakturaMockServer } from './eFakturaMockServer';

const mockServer = new EFakturaMockServer();
mockServer.setupRoutes();

mockServer.start().then(() => {
  console.log('Mock eFaktura server is running on http://localhost:3005');
  console.log('Available endpoint:');
  console.log('GET /api/publicApi/sales-invoice/xml?invoiceId={id}');
  console.log('Required headers:');
  console.log('- ApiKey: d2e7f81c-64c7-4c61-9b43-b6d215d9a2cf');
});
