pragma circom 2.1.5;

include "../../../../../../../node_modules/circomlib/circuits/sha256/sha256.circom";
include "../../../../../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../../../../../node_modules/circomlib/circuits/bitify.circom";


/// Computes hash of the concatenation of left and right (as numbers)
template HashLeftRight() {
    signal input left[256];
    signal input right[256];
    signal output hash[256];

    // Concatenate the two inputs
    component concatenate = BitsConcat(256, 256);
    concatenate.left <== left;
    concatenate.right <== right;

    // Hash the concatenated input
    component sha256 = Sha256(512);
    sha256.in <== concatenate.out;
    hash <== sha256.out;
}

template BitsConcat(n1, n2) {
    signal input left[n1];
    signal input right[n2];
    signal output out[n1 + n2];
    for (var i = 0; i < n1; i++) {
        out[i] <== left[i];
    }
    for (var i = 0; i < n2; i++) {
        out[n1 + i] <== right[i];
    }
}

// if s == 0 returns [in[0], in[1]]
// if s == 1 returns [in[1], in[0]]
template DualMux() {
    signal input in[2][256];     // Now handles 256-bit arrays
    signal input s;
    signal output out[2][256];

    for (var i = 0; i < 256; i++) {
        out[0][i] <== (in[1][i] - in[0][i]) * s + in[0][i];
        out[1][i] <== (in[0][i] - in[1][i]) * s + in[1][i];
    }
}

// Verifies that merkle proof is correct for given merkle root and a leaf
// pathIndices input is an array of 0/1 selectors telling whether given pathElement is on the left or right side of merkle path
template MerkleProofVerifier(levels) {
    signal input leaf[256];
    signal input root[256];
    signal input pathElements[levels][256];
    signal input pathIndices[levels];
    signal output isVerified;

    component selectors[levels];
    component hashers[levels];

    for (var i = 0; i < levels; i++) {
        selectors[i] = DualMux();
        selectors[i].in[0] <== i == 0 ? leaf : hashers[i - 1].hash;
        selectors[i].in[1] <== pathElements[i];
        selectors[i].s <== pathIndices[i];

        hashers[i] = HashLeftRight();
        hashers[i].left <== selectors[i].out[0];
        hashers[i].right <== selectors[i].out[1];
    }

    component isEqualMerkleProof[256];
    signal isEqualOutput[257];
    isEqualOutput[0] <== 1;

    for(var i = 0; i < 256; i++) { 
    isEqualMerkleProof[i] = IsEqual();
    isEqualMerkleProof[i].in[0] <== root[i];
    isEqualMerkleProof[i].in[1] <== hashers[levels - 1].hash[i];
    isEqualOutput[i+1] <== isEqualOutput[i] * isEqualMerkleProof[i].out;
    }

    isVerified <== isEqualOutput[256];
}