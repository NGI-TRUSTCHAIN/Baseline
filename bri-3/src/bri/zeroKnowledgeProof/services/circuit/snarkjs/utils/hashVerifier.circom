pragma circom 2.1.5;

include "../../../../../../../node_modules/circomlib/circuits/sha256/sha256.circom";
include "../../../../../../../node_modules/circomlib/circuits/bitify.circom";
include "../../../../../../../node_modules/circomlib/circuits/comparators.circom";

// HashVerifier template
//Take max lenght and before inputting to the hash check if the length is correct
// if less than max length, pad with 0s
// if more than max length, truncate to max length
template HashVerifier(maxLength) {
    signal input preimage[maxLength];
    signal input expectedHash[256];
    signal output isVerified; 

    component sha256 = Sha256(maxLength);
    sha256.in <== preimage;
    signal preimageHash[256];

    for (var i = 0; i < 256; i++) {
        preimageHash[i] <== sha256.out[i];
    }

    //Compare expected hash with computed hash
    signal isEqualTag <== 1;
    component isEqualBits[256];
    signal isEqualResult[256];
    for (var i = 0; i < 256; i++) {
        var eq = 0;
        isEqualBits[i] = IsEqual();
        isEqualBits[i].in[0] <== preimageHash[i];
        isEqualBits[i].in[1] <== expectedHash[i];

        if(i == 0) {
            isEqualResult[i] <== isEqualBits[i].out;
        } else {
            isEqualResult[i] <== isEqualResult[i-1] * isEqualBits[i].out;
        }
    }

    // Output 
   isVerified <== isEqualResult[255]; 
}