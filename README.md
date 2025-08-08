# Baseline Protocol for Cross-Jurisdictional Invoice Financing

## NGI TRUSTCHAIN Open Call 4 Project

A production-ready implementation of the Baseline Protocol enabling standardized, verifiable cross-border SME invoice financing between Serbian and Romanian markets through privacy-preserving zero-knowledge proofs and blockchain verification.

---

## 🎯 Project Overview

### **Use Case: Cross-Border Invoice Portfolio Aggregation**

This project addresses the critical SME financing gap in Central and Eastern European markets by creating a standardized, verifiable process for invoice origination that enables portfolio aggregation across jurisdictions. The solution bridges the disconnect between fragmented local invoice financing companies and large debt providers seeking standardized, auditable investment opportunities.

### **Technology Readiness Level: TRL6**
- **Achieved**: Technology demonstrated in relevant environment using real-world data
- **Evidence**: End-to-end testing with genuine Serbian and Romanian invoice data formats, actual certificate structures, and real API response patterns from government systems
- **Validation**: Successful cross-BPI communication, zero-knowledge proof generation, and independent third-party verification

---

## 🏗️ Technical Architecture

### **Dual-BPI Implementation**
- **Serbian BPI**: Manages Serbian invoice origination with e-invoicing platform integration
- **Romanian BPI**: Handles Romanian invoice validation with business registry verification  
- **Interoperability Layer**: Enables seamless cross-border data aggregation hosted within Serbian BPI

### **Key Technical Components**

#### **Multi-Chain Blockchain Support**
- **Primary**: Polygon, Avalanche (EVM-compatible)
- **Capability**: Cross-chain proof verification for independent auditing
- **Smart Contracts**: BPI State Anchor & Verifier contracts for proof storage

#### **Zero-Knowledge Proof System**
- **Custom Circom Circuits**: Validate Serbian/Romanian government certificate formats
- **Privacy-Preserving**: Verify invoice authenticity without exposing sensitive financial data
- **Jurisdiction-Specific**: Handle unique requirements while maintaining interoperability

#### **External System Integration**
- **Serbian E-Invoicing Platform**: API integration with government-signed responses
- **Romanian Business Registry**: Enhanced security through certificate validation
- **Multi-Format Support**: JSON and XML data processing for legacy ERP compatibility

---

## 🚀 Quick Start

### **Prerequisites**
- Docker & Docker Compose
- Git
- Node.js 18+ (for development)

### **Local Development Setup**
```bash

# Clone the repository
git clone https://github.com/NGI-TRUSTCHAIN/Baseline.git
cd Baseline
cd bri-3

# DB

$ docker run --name postgres -e POSTGRES_PASSWORD=example -p 5432:5432 -d postgres # start a postgres container
$ create a .env file based on the .env.sample # provide a connection string for the db instance
$ npm install # install project dependencies
$ npm run prisma:generate # generate the prisma client 
$ npm run prisma:migrate:dev # migrate the db to latest state
$ npx prisma db seed # seed db

$ npx prisma migrate reset # reset the db to initial state, remove all data and apply seed

```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# For manual testing, swagger is running on http://localhost:3000/api
# To get json format to use tools like postman, checkout http://localhost:3000/api-json 

$ npm run start
```

```bash
# Unit testing - .spec files located next to the thing they are testing

$ npm run test

# Run single spec file
$ npm run test -- transactions.agent.spec.ts
```
```bash
# Use following commands to generate the zk artifacts for the origination e2e test case

$ cd Baseline/bri-3
$ PROTOCOL=plonk npm run snarkjs:circuit originationWorkgroup/serbia_workstep1
$ PROTOCOL=plonk npm run snarkjs:circuit originationWorkgroup/serbia_workstep2
$ PROTOCOL=plonk npm run snarkjs:circuit originationWorkgroup/serbia_workstep3
$ PROTOCOL=plonk npm run snarkjs:circuit originationWorkgroup/serbia_workstep4
$ PROTOCOL=plonk npm run snarkjs:circuit originationWorkgroup/romania_workstep1 
```

```bash
# e2e testing - .e2e.spec files and the bash script used for running located in ./test folder
# before running the tests, make sure that postgres and nats are running
# also make sure that the .env file contains correct values for DID login to work (as explained in the .env.sample)

$ cd test
$ sh ./e2e-test-sri.sh
$ sh ./e2e-test-origination.sh
```

To run e2e tests with docker:

```bash
$ make test-sri
```

```bash
$ make test-origination
```

### make test-origination

This single command:
- Spins up complete dockerized infrastructure
- Executes Serbian and Romanian invoice validation workflows
- Demonstrates cross-BPI communication
- Validates zero-knowledge proof generation
- Simulates government API interactions

### **Local Environment Includes**
- PostgreSQL databases (Romanian & Serbian BPIs)
- NATS messaging system
- Mock external APIs (business registries, e-invoicing platforms)
- Blockchain interaction layers
- Both BPI instances with full workflow support

---

## Messaging

Relevant information can be found in ./docs/nats/nats-configuration.md

## Environment configuration

Can be found in ./env.sample.

Relevant information on DID Auth can be found in ./docs/dids/did-authentication.md

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```


## 📋 Core Features

### **For Invoice Financing Companies**
- **Standardized Origination**: Unified invoice submission process across jurisdictions
- **Automated Verification**: Digital signature and business registry validation
- **Minimal Integration**: REST APIs with comprehensive documentation
- **Privacy Protection**: Zero-knowledge proofs protect sensitive business data

### **For Debt Providers** 
- **Portfolio Aggregation**: Cross-border invoice portfolio consolidation
- **Independent Verification**: Blockchain-stored proofs for third-party auditing
- **Regulatory Compliance**: Jurisdiction-specific validation workflows
- **Risk Assessment**: Standardized data formats for consistent analysis

### **For Auditors & Regulators**
- **Independent Verification**: Blockchain-based proof validation without system access
- **Compliance Tracking**: Complete audit trails for regulatory requirements
- **Cross-Border Transparency**: Standardized verification across jurisdictions

---

## 🔧 API Documentation

### **Core Endpoints**

#### **Invoice Submission**
```http
POST /workgroups/{workgroupId}/workflows/{workflowId}/transactions
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "workstepIndex": 0,
  "payload": {
    "invoiceData": "...",
    "certificateData": "...",
    "supplierDetails": "..."
  }
}
```

#### **Transaction Status**
```http
GET /transactions/{transactionId}
Authorization: Bearer <JWT>
```

#### **Cross-BPI Data Retrieval**
```http
GET /workgroups/{interopWorkgroupId}/aggregated-data
Authorization: Bearer <JWT>
```

#### **Independent Verification**
```http
GET /verification/proofs/{proofHash}
# Public endpoint - no authentication required
```

### **Authentication**
All API endpoints require JWT authentication except public verification endpoints. Authentication is managed through the BPI identity system with role-based access control.

---

## 🌍 Real-World Implementation

### **Current Validation Status**
- **Testing**: Comprehensive end-to-end scenarios with real data formats
- **Government Integration**: Successfully integrated with Serbian e-invoicing platform (signed responses)
- **Certificate Validation**: Romanian and Serbian government certificate verification
- **Cross-Border Proof**: Demonstrated portfolio aggregation across jurisdictions

### **Pilot Participants**
- **Debt Funds**: Representatives managing €400M+ in developing market assets
- **Invoice Financing Companies**: Serbian and Romanian market leaders
- **Verification Services**: Business registries and e-invoicing platform providers
- **Auditors**: Independent verification specialists

### **Staging Environment**
Production-ready staging environment with:
- Polygon/Avalanche testnet integration
- Real government API connections (where available)
- Full workflow simulation capabilities
- Monitoring and logging infrastructure

---

## 🔐 Security & Privacy

### **Privacy-by-Design**
- **Zero-Knowledge Proofs**: Verify data validity without exposing content
- **Selective Disclosure**: Share only necessary information with debt providers
- **Encrypted Communications**: All inter-BPI messaging encrypted
- **Role-Based Access**: Granular permissions per participant type

### **Compliance Framework**
- **GDPR Compliant**: European data protection standards
- **Local Regulations**: Serbian and Romanian financial regulations
- **Audit Ready**: Complete transaction trails for regulatory review
- **Data Sovereignty**: Jurisdiction-specific data handling

---

## 🏆 TRUSTCHAIN Alignment

### **Ecosystem Contributions**
- **Reusable Modules**: Identity management, cross-border financial processes
- **Technical Innovation**: Privacy-preserving compliance verification
- **Interoperability**: Standard APIs for financial data exchange
- **Open Source**: All components available for community use

### **Value to TrustChain**
- **Real-World Application**: Proven blockchain use case in traditional finance
- **Cross-Project Synergies**: Reusable components for other financial applications  
- **Market Validation**: Demonstrated business viability and user adoption
- **Technical Leadership**: Advanced ZKP applications in regulatory compliance

---

## 📚 Documentation

### **Developer Resources**
- **API Reference**: Complete OpenAPI/Swagger documentation
- **Integration Guide**: Step-by-step implementation instructions

---

## 🔄 Development Status

### **Completed Features**
- ✅ Dual-BPI architecture with interoperability layer
- ✅ Serbian e-invoicing platform integration
- ✅ Romanian business registry validation
- ✅ Custom zero-knowledge circuits for both jurisdictions
- ✅ Multi-chain blockchain support (Polygon, Avalanche)
- ✅ Comprehensive API suite with authentication
- ✅ Docker containerization for all components
- ✅ End-to-end testing framework
- ✅ Mock external system integrations

### **In Progress (D4 Focus)**
- 🔄 Production staging environment deployment
- 🔄 Pilot testing with real participants
- 🔄 Enhanced monitoring and logging
- 🔄 Performance optimization and scaling
- 🔄 Final security audits and penetration testing


---

## 🚀 Deployment Options

### **Local Development**
```bash
make test-origination  # Complete test scenario
make start-dev         # Development mode with hot reload
make test-unit         # Run unit test suite
```

### **Staging Environment**
- **URL**: Will be provided for D4 pilot participants
- **Features**: Full production simulation with testnet blockchains
- **Access**: Controlled access for pilot participants and evaluators


## 📄 License & Contributing

### **Open Source License**
This project is released under Apache License as part of the NGI TRUSTCHAIN initiative.

### **Contributing**
We welcome contributions from the community. Please see our contributing guidelines and code of conduct.

### **Citation**
If you use this work in academic research, please cite our TRUSTCHAIN deliverables and publications.

---

## 🔗 Links & Resources

- **Project Repository**: https://github.com/NGI-TRUSTCHAIN/Baseline
- **TRUSTCHAIN Program**: [NGI TRUSTCHAIN Website]
- **Technical Documentation**: [Link to comprehensive docs]
- **API Documentation**: [Swagger/OpenAPI endpoint]
- **Community Forum**: [Discord/Telegram link]

---

*This project is funded by the European Union's Next Generation Internet (NGI) TRUSTCHAIN program under Grant Agreement No. [Agreement Number]. The content reflects only the authors' views and the European Commission is not responsible for any use that may be made of the information it contains.*