pragma circom 2.1.5;

include "../generalisedCircuit/businessLogic.circom";

// Supplier signature is valid
template InteropSerbiaWorkstep1()
{
	signal input supplierSignatureMessageBits[256];
	signal input supplierSignatureR8Bits[256];
	signal input supplierSignatureABits[256];
	signal input supplierSignatureSBits[256];

	signal output isVerified;
	
	component businessLogic = BusinessLogic(
	    [0, 0, 0, 0, 1],       // businessOperations counts
	    [0, 0, 0, 0, 256],       // 0,0, Merkle Tree Height-2, (512-bit hash) for HashVerifier, (256-bit signature) for SignatureVerifier
	    0,                     // nLogicGates
	    [0]                  // truthTable
	);

	//Signature verification
	businessLogic.signatureVerificationMessage <== [supplierSignatureMessageBits];
	businessLogic.signatureVerificationR8 <== [supplierSignatureR8Bits];
	businessLogic.signatureVerificationA <== [supplierSignatureABits];
	businessLogic.signatureVerificationS <== [supplierSignatureSBits];

	//Output
	isVerified <== businessLogic.resultOut;

}

component main {public [supplierSignatureMessageBits]} = InteropSerbiaWorkstep1();