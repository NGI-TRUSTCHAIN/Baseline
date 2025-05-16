pragma circom 2.1.5;
include "../../../../../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../../../../../node_modules/circomlib/circuits/gates.circom";
include "../../../../../../../node_modules/circomlib/circuits/eddsa.circom";
include "../utils/rangeCheck.circom";
include "../utils/merkleProofVerifier.circom";
include "../utils/hashVerifier.circom";

/**
 * This circuit runs business logic by combining multiple operations 
 * (equality, range check, membership check, 
 * hash verification, merkle proof verification, signature verification, etc) using
 * logic gates defined in a truth table (AND, OR, NOT, etc.).
 * 
 * @param businessOperations - Number of business logic operations to perform.
 * The circuit currently supports:
 * 1. IsEqual
 * 2. RangeCheck
 * 3. MerkleProofVerification
 * 4. Hash verification
 * 5. Signature verification
 * @param businessOperationParams - Parameters for each business logic operation.
 * @param nLogicGates - Number of logic gate operations to perform (AND, OR, NOT).
 * @param truthTable - Defines sequence and inputs of logic gates for combining results of business logic operations (equality, RangeCheck, etc.).
 * Each row in the truth table contains:
 * 1. The logic gate to use (0 = AND, 1 = OR, 2 = NOT).
 * 2. The index of the first input to use.
 * 3. The source of the first input (0 for output, 1 for intermediate).
 * 4. The index of the second input to use.
 * 5. The source of the second input (0 for output, 1 for intermediate).
 *
 *
 *
 * @returns True/False after verifying the business logic.
 */
template BusinessLogic(
    businessOperations, businessOperationParams, nLogicGates, truthTable
){
    signal output resultOut;

    // Input & Components for operations   
    // 0: IsEqual
    var nIsEqual = businessOperations[0];
    var isEqualParam = businessOperationParams[0];
    
    signal input isEqualA[nIsEqual];
    signal input isEqualB[nIsEqual];
    component isEquals[nIsEqual];
   
    //1: RangeCheck
    var nRangeCheck = businessOperations[1];
    var rangeCheckParam = businessOperationParams[1];
    
    signal input rangeCheckValue[nRangeCheck];
    signal input rangeCheckMin[nRangeCheck];
    signal input rangeCheckMax[nRangeCheck];
    component rangeChecks[nRangeCheck];
    
    //2: Merkle Proof Check
    var nMerkleProofVerification = businessOperations[2];
    var merkleProofVerificationParam = businessOperationParams[2];

    signal input merkleProofLeaf[nMerkleProofVerification][256];
    signal input merkleProofRoot[nMerkleProofVerification][256];
    signal input merkleProofPathElement[nMerkleProofVerification][merkleProofVerificationParam * 256];
    signal input merkleProofPathIndex[nMerkleProofVerification][merkleProofVerificationParam];
    component merkleProofVerifications[nMerkleProofVerification];

    //3: Hash verification
    var nHashVerification = businessOperations[3];
    var inputsPerHashVerification = 2;
    var hashVerificationParam = businessOperationParams[3];

    signal input hashVerificationPreimage[nHashVerification][hashVerificationParam];
    signal input hashVerificationExpectedHash[nHashVerification][256];
    component hashVerifications[nHashVerification];

    //4: Signature Verification
    var nSignatureVerification = businessOperations[4];
    var inputsPerSignatureVerification = 4;
    var signatureVerificationParam = businessOperationParams[4];

    signal input signatureVerificationMessage[nSignatureVerification][256];
    signal input signatureVerificationA[nSignatureVerification][256];
    signal input signatureVerificationR8[nSignatureVerification][256];
    signal input signatureVerificationS[nSignatureVerification][256];
    component signatureVerifications[nSignatureVerification];


    // Outputs from operations
    signal outputs[nIsEqual + nRangeCheck + nMerkleProofVerification + nHashVerification + nSignatureVerification];
    signal intermediates[nLogicGates];

    //Index for the inputs and output array
    var outputIndex = 0;

    // Step 1: Get outputs of Business operations
    // IsEqual
    for (var i = 0; i < nIsEqual; i++) {
        isEquals[i] = parallel IsEqual();
        isEquals[i].in[0] <== isEqualA[i];
        isEquals[i].in[1] <== isEqualB[i];
        outputs[outputIndex] <== isEquals[i].out;
        outputIndex++;
    }

    // RangeCheck
    for (var j = 0; j < nRangeCheck; j++) {
        rangeChecks[j] = parallel RangeCheck(rangeCheckParam);   
        rangeChecks[j].x <== rangeCheckValue[j];
        rangeChecks[j].min <== rangeCheckMin[j];
        rangeChecks[j].max <== rangeCheckMax[j];
        outputs[outputIndex] <== rangeChecks[j].isInRange;
        outputIndex++;
    }

    // MerkleProofVerification
    component isEqualMerkleProof[nMerkleProofVerification];
    for (var l = 0; l < nMerkleProofVerification; l++) {
        var verifiedFlag = 0;
        merkleProofVerifications[l] = parallel MerkleProofVerifier(merkleProofVerificationParam);
        merkleProofVerifications[l].leaf <== merkleProofLeaf[l];
        merkleProofVerifications[l].root <== merkleProofRoot[l];
        for (var j = 0; j < merkleProofVerificationParam; j++) {
            for (var k = 0; k < 256; k++) {
                merkleProofVerifications[l].pathElements[j][k] <== merkleProofPathElement[l][j * 256 + k];
            }
        }
        merkleProofVerifications[l].pathIndices <== merkleProofPathIndex[l];
        outputs[outputIndex] <== merkleProofVerifications[l].isVerified;
        outputIndex++;
    }

    // Hash verification
    for (var l = 0; l < nHashVerification; l++) {
        hashVerifications[l] = parallel HashVerifier(hashVerificationParam);
        hashVerifications[l].preimage <== hashVerificationPreimage[l]; 
        hashVerifications[l].expectedHash <== hashVerificationExpectedHash[l];
        outputs[outputIndex] <== hashVerifications[l].isVerified;
        outputIndex++;
    }

    // Signature verification
    component isEqualSignature[nSignatureVerification];
    for (var l = 0; l < nSignatureVerification; l++) {
        var verifiedFlag = 0;
        signatureVerifications[l] = parallel EdDSAVerifier(256);
        signatureVerifications[l].msg <== signatureVerificationMessage[l];
        signatureVerifications[l].A <== signatureVerificationA[l];
        signatureVerifications[l].R8 <== signatureVerificationR8[l];
        signatureVerifications[l].S <== signatureVerificationS[l];
        verifiedFlag = 1;
        isEqualSignature[l] = IsEqual();
        isEqualSignature[l].in[0] <== verifiedFlag;
        isEqualSignature[l].in[1] <== 1;
        outputs[outputIndex] <== isEqualSignature[l].out;
        outputIndex++;
    }
    

    // Step 2: Flexible logic combining using circomlib gates (AND, OR, NOT)
    var inA;
    var inB;

    for (var opIdx = 0; opIdx < nLogicGates; opIdx++) {
        var packed = truthTable[opIdx];

        // Unpack fields
        var op   = (packed >> 10) & 3;     // bits 11-10 --> 2 bits
        var srcB = (packed >> 9) & 1;      // bit 9 --> 1 bit
        var idxB = (packed >> 5) & 15;     // bits 8-5 --> 4 bits
        var srcA = (packed >> 4) & 1;      // bit 4 --> 1 bits
        var idxA = packed & 15;            // bits 3-0 --> 4 bits

        inA = srcA == 0 ? outputs[idxA] : intermediates[idxA];
        inB = srcB == 0 ? outputs[idxB] : intermediates[idxB];

        var andOut = inA * inB;
        var orOut = inA + inB - inA * inB;
        var notOut = 1 - inA; 

        if (op == 0) {
            intermediates[opIdx] <== andOut;
        } else if (op == 1) {
            intermediates[opIdx] <== orOut;
        } else if (op == 2) {
            intermediates[opIdx] <== notOut;
        } else {
            intermediates[opIdx] <== 0;
        }
    }

    // Step 3: Final output
    resultOut <== nLogicGates == 0 ? outputs[0] : intermediates[nLogicGates - 1];
}