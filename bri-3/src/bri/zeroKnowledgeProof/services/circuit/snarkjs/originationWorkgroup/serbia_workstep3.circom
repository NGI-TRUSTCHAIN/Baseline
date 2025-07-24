pragma circom 2.1.5;

include "../generalisedCircuit/businessLogic.circom";

// Supplier signature is valid
template InteropSerbiaWorkstep3()
{
	signal input supplierIdLeaf;
	signal input supplierIdRoot;
	signal input supplierIdPathElement[1]; // Height of tree: 1 (2 leaves), each 256 bits
	signal input supplierIdPathIndex[1];

	signal output isVerified;
	
	component businessLogic = BusinessLogic(
	    [0, 0, 1, 0, 0],       // businessOperations counts
	    [0, 0, 1, 0, 0],       // 0,0, Merkle Tree Height-1, , (256-bit signature) for SignatureVerifier
	    0,                     // nLogicGates
	    [0]                  // truthTable
	);

	//Merkle proof verification
	businessLogic.merkleProofLeaf <== [supplierIdLeaf];
	businessLogic.merkleProofRoot <== [supplierIdRoot];
	businessLogic.merkleProofPathElement <== [supplierIdPathElement];
	businessLogic.merkleProofPathIndex <== [supplierIdPathIndex];

	//Output
	isVerified <== businessLogic.resultOut;

}

component main {public [supplierIdLeaf]} = InteropSerbiaWorkstep3();