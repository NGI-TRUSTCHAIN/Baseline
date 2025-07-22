pragma circom 2.1.5;

include "../generalisedCircuit/businessLogic.circom";

// Supplier signature is valid
template InteropRomaniaWorkstep1()
{
	signal input supplierSignatureMessageBits[256];
	signal input supplierSignatureR8Bits[256];
	signal input supplierSignatureABits[256];
	signal input supplierSignatureSBits[256];

	signal input buyerSignatureMessageBits[256];
	signal input buyerSignatureR8Bits[256];
	signal input buyerSignatureABits[256];
	signal input buyerSignatureSBits[256];

	signal output isVerified;
	
	component businessLogic = BusinessLogic(
	    [0, 0, 0, 0, 2],       // businessOperations counts
	    [0, 0, 0, 0, 256],       // 0,0, Merkle Tree Height-2, (512-bit hash) for HashVerifier, (256-bit signature) for SignatureVerifier
	    1,                     // nLogicGates
	    [32]                  // truthTable
	);

	//Signature verification
	businessLogic.signatureVerificationMessage <== [supplierSignatureMessageBits, buyerSignatureMessageBits];
	businessLogic.signatureVerificationR8 <== [supplierSignatureR8Bits, buyerSignatureR8Bits];
	businessLogic.signatureVerificationA <== [supplierSignatureABits, buyerSignatureABits];
	businessLogic.signatureVerificationS <== [supplierSignatureSBits, buyerSignatureSBits];

	//Output
	isVerified <== businessLogic.resultOut;

}

component main {public [supplierSignatureMessageBits, buyerSignatureMessageBits]} = InteropRomaniaWorkstep1();