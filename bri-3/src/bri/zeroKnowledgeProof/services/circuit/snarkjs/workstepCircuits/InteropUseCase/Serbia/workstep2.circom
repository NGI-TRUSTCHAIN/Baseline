pragma circom 2.1.5;

include "../../../generalisedCircuit/businessLogic.circom";

// Supplier signature is valid
template InteropSerbiaWorkstep2()
{
	signal input efaktureSignatureMessageBits[256];
	signal input efaktureSignatureR8Bits[256];
	signal input efaktureSignatureABits[256];
	signal input efaktureSignatureSBits[256];

	signal input signerNameLeaf;
	signal input signerNameRoot;
	signal input signerNamePathElement[1]; // Height of tree: 1, each 256 bits
	signal input signerNamePathIndex[1];

	signal output isVerified;
	
	component businessLogic = BusinessLogic(
	    [0, 0, 1, 0, 1],       // businessOperations counts
	    [0, 0, 1, 0, 256],       // 0,0, Merkle Tree Height-1, , (256-bit signature) for SignatureVerifier
	    1,                     // nLogicGates
	    [32]                  // truthTable
	);

	//Signature verification
	businessLogic.signatureVerificationMessage <== [efaktureSignatureMessageBits];
	businessLogic.signatureVerificationR8 <== [efaktureSignatureR8Bits];
	businessLogic.signatureVerificationA <== [efaktureSignatureABits];
	businessLogic.signatureVerificationS <== [efaktureSignatureSBits];

	//Merkle proof verification
	businessLogic.merkleProofLeaf <== [signerNameLeaf];
	businessLogic.merkleProofRoot <== [signerNameRoot];
	businessLogic.merkleProofPathElement <== [signerNamePathElement];
	businessLogic.merkleProofPathIndex <== [signerNamePathIndex];

	//Output
	isVerified <== businessLogic.resultOut;

}

component main {public [efaktureSignatureMessageBits, signerNameLeaf]} = InteropSerbiaWorkstep2();