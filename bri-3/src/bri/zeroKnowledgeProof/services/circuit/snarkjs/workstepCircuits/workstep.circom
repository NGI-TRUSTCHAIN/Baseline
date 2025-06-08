pragma circom 2.1.5;

include "../generalisedCircuit/businessLogic.circom";

//TEST GENERAL BUSINESS LOGIC CIRCUIT

//((a==b) OR (c==d)) AND (e≤f≤g) AND ((h ∈ [i,j,k,l]) OR (hash of x matches expected)) AND (signature is valid)
//CAUTION: Signature validation must always be ANDed with the other logic gates (due to assert in EDdsa circom).

component main {public [isEqualA, rangeCheckValue, merkleProofLeaf, hashVerificationPreimage, signatureVerificationMessage ]} = BusinessLogic(
    [2, 1, 1, 1, 1],        // Operations: 2 IsEqual, 1 RangeCheck, 1 MerkleProofVerification, 1 HashVerifier, 1 SignatureVerifier
    [0, 32, 2, 512, 256],   // Params: (0) for IsEqual, (32-bit) for RangeCheck, (4-member set --> Tree height 2) for MerkleProofVerification, (512-bit hash) for HashVerifier, (256-bit signature) for SignatureVerifier
    5,                     // Total logic gates = 5
    [
        1056,   // Gate 0: OR(outputs[0], outputs[1]) = (1 << 10) | (0 << 9) | (1 << 5) | (0 << 4) | 0 = 1024 + 32 = 1056
        80,     // Gate 1: AND(intermediates[0], outputs[2]) = (0 << 10) | (0 << 9) | (2 << 5) | (1 << 4) | 0 = 64 + 16 = 80
        1155,   // Gate 2: OR(outputs[3], outputs[4]) = (1 << 10) | (0 << 9) | (4 << 5) | (0 << 4) | 3 = 1024 + 128 + 3 = 1155
        593,    // Gate 3: AND(intermediates[1], intermediates[2])= (0 << 10) | (1 << 9) | (2 << 5) | (1 << 4) | 1 = 512 + 64 + 16 + 1 = 593
        179     // Gate 4: AND(intermediates[3], outputs[5]) = (0 << 10) | (0 << 9) | (5 << 5) | (1 << 4) | 3 = 160 + 16 + 3 = 179
    ]
);