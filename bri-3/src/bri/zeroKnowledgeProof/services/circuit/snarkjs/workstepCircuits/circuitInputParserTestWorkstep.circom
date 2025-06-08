pragma circom 2.1.5;

include "../generalisedCircuit/businessLogic.circom";

//TEST GENERAL BUSINESS LOGIC CIRCUIT

// (h ∈ [i,j,k,l]) AND (hash of x matches expected) AND (signature is valid)
template CircuitInputParserTestWorkstep()
{
	signal input certificateSignatureMessageBits[256];
	signal input certificateSignatureR8Bits[256];
	signal input certificateSignatureABits[256];
	signal input certificateSignatureSBits[256];

	signal input signerNameLeaf;
	signal input signerNameRoot;
	signal input signerNamePathElement[2]; // Height of tree: 2
	signal input signerNamePathIndex[2];

	signal input certHashPreimage[18464];
	signal input certHashExpectedHash[256];

	signal output isVerified;
	
	component businessLogic = BusinessLogic(
	    [0, 0, 1, 1, 1],       // businessOperations counts
	    [0, 0, 2, 18464, 256],       // 0,0, Merkle Tree Height-2, (512-bit hash) for HashVerifier, (256-bit signature) for SignatureVerifier
	    2,                     // nLogicGates
	    [32, 80]               // truthTable: AND(outputs[0], outputs[1]), then AND(intermediate[0], outputs[2])
	);

	//Signature verification
	businessLogic.signatureVerificationMessage <== [certificateSignatureMessageBits];
	businessLogic.signatureVerificationR8 <== [certificateSignatureR8Bits];
	businessLogic.signatureVerificationA <== [certificateSignatureABits];
	businessLogic.signatureVerificationS <== [certificateSignatureSBits];

	//Merkle proof verification
	businessLogic.merkleProofLeaf <== [signerNameLeaf];
	businessLogic.merkleProofRoot <== [signerNameRoot];
	businessLogic.merkleProofPathElement <== [signerNamePathElement];
	businessLogic.merkleProofPathIndex <== [signerNamePathIndex];

	//Hash verification
	businessLogic.hashVerificationPreimage <== [certHashPreimage];
	businessLogic.hashVerificationExpectedHash <== [certHashExpectedHash];

	//Output
	isVerified <== businessLogic.resultOut;

}

component main {public [signerNameLeaf, certHashPreimage, certificateSignatureMessageBits ]} = CircuitInputParserTestWorkstep();