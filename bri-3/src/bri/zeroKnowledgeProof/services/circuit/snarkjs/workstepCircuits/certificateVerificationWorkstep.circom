pragma circom 2.1.5;

include "../generalisedCircuit/businessLogic.circom";

//TEST GENERAL BUSINESS LOGIC CIRCUIT

// (h ∈ [i,j,k,l]) AND (hash of x matches expected) AND (signature is valid)
//CAUTION: Signature validation must always be ANDed with the other logic gates (due to assert in EDdsa circom).

component main {public [isEqualA, rangeCheckValue, merkleProofLeaf, hashVerificationPreimage, signatureVerificationMessage ]} = BusinessLogic(
    [0, 0, 1, 1, 1],       // businessOperations counts
    [0, 0, 2, 18464, 256],       //  0,0, Merkle Tree Height-2, (512-bit hash) for HashVerifier, (256-bit signature) for SignatureVerifier
    2,                     // nLogicGates
    [32, 80]               // truthTable: AND(outputs[0], outputs[1]), then AND(intermediate[0], outputs[2])
);