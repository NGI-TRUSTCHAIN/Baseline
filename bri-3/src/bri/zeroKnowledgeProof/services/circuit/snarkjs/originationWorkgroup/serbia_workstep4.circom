pragma circom 2.1.5;

include "../generalisedCircuit/businessLogic.circom";

// Supplier signature is valid
template InteropSerbiaWorkstep4()
{
	signal input invoiceStatusLeaf;
	signal input invoiceStatusRoot;
	signal input invoiceStatusPathElement[1]; // Height of tree: 1 (2 leaves), each 256 bits
	signal input invoiceStatusPathIndex[1];

	signal output isVerified;
	
	component businessLogic = BusinessLogic(
	    [0, 0, 1, 0, 0],       // businessOperations counts
	    [0, 0, 1, 0, 0],       // 0,0, Merkle Tree Height-1, , (256-bit signature) for SignatureVerifier
	    0,                     // nLogicGates
	    [0]                  // truthTable
	);

	//Merkle proof verification
	businessLogic.merkleProofLeaf <== [invoiceStatusLeaf];
	businessLogic.merkleProofRoot <== [invoiceStatusRoot];
	businessLogic.merkleProofPathElement <== [invoiceStatusPathElement];
	businessLogic.merkleProofPathIndex <== [invoiceStatusPathIndex];

	//Output
	isVerified <== businessLogic.resultOut;

}

component main {public [invoiceStatusLeaf]} = InteropSerbiaWorkstep4();