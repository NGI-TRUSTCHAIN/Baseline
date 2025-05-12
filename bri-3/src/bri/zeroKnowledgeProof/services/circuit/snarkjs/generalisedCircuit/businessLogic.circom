pragma circom 2.1.5;
include "../../../../../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../../../../../node_modules/circomlib/circuits/gates.circom";
include "../../../../../../../node_modules/circomlib/circuits/eddsa.circom";
include "../utils/rangeCheck.circom";
include "../utils/membershipCheck.circom";
include "../utils/hashVerifier.circom";

//TODO: Issue #30
//TODO: Issue #31
//TODO: Issue #33
//TODO: Issue #34

/**
 * This circuit runs business logic by combining multiple operations 
 * (equality, range check, membership check, 
 * hash verification, merkle proof verification, signature verification, etc) using
 * logic gates defined in a truth table (AND, OR, NOT, etc.).
 * 
 * @param businessOperations - Number of business logic operations to perform.
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
    var inputsPerIsEqual = 2;
    var isEqualParam = businessOperationParams[0];
    
    signal input isEqualA[nIsEqual];
    signal input isEqualB[nIsEqual];
    component isEquals[nIsEqual];
   
    //1: RangeCheck
    var nRangeCheck = businessOperations[1];
    var inputsPerRangeCheck = 3;
    var rangeCheckParam = businessOperationParams[1];
    
    signal input rangeCheckValue[nRangeCheck];
    signal input rangeCheckMin[nRangeCheck];
    signal input rangeCheckMax[nRangeCheck];
    component rangeChecks[nRangeCheck];
    
    //2: MembershipCheck
    var nMembershipCheck = businessOperations[2];
    var inputsPerMembershipCheck = 1 + businessOperationParams[2];
    var membershipCheckParam = businessOperationParams[2];

    signal input membershipCheckValue[nMembershipCheck];
    signal input membershipCheckSets[nMembershipCheck][membershipCheckParam];
    component membershipChecks[nMembershipCheck];

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
    signal outputs[nIsEqual + nRangeCheck + nMembershipCheck + nHashVerification + nSignatureVerification];
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

    // MembershipCheck
    for (var k = 0; k < nMembershipCheck; k++) {
        membershipChecks[k] = parallel MembershipCheck(membershipCheckParam);
        membershipChecks[k].x <== membershipCheckValue[k];
        for (var l = 0; l < membershipCheckParam; l++) {
            membershipChecks[k].values[l] <== membershipCheckSets[k][l];
        }
        outputs[outputIndex] <== membershipChecks[k].isMember;
        outputIndex++;
    }

    // Hash verification
    for (var l = 0; l < nHashVerification; l++) {
        hashVerifications[l] = parallel HashVerifier(hashVerificationParam); 
        for (var m = 0; m < hashVerificationParam; m++) {
            hashVerifications[l].preimage[m] <== hashVerificationPreimage[l][m];
        }
        for (var n = 0; n < 256; n++) {
            hashVerifications[l].expectedHash[n] <== hashVerificationExpectedHash[l][n];
        } 
        outputs[outputIndex] <== hashVerifications[l].isVerified;
        outputIndex++;
    }

    // Signature verification
    component isEqualSignature[nSignatureVerification];
    for (var l = 0; l < nSignatureVerification; l++) {
        var verifiedFlag = 0;
        signatureVerifications[l] = parallel EdDSAVerifier(256);
        for (var m = 0; m < 256; m++) {
            signatureVerifications[l].msg[m] <== signatureVerificationMessage[l][m];
            signatureVerifications[l].A[m] <== signatureVerificationA[l][m];
            signatureVerifications[l].R8[m] <== signatureVerificationR8[l][m];
            signatureVerifications[l].S[m] <== signatureVerificationS[l][m];	
        }
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
        var baseIdx = 5 * opIdx;
        var op = truthTable[baseIdx];
        var idxA = truthTable[baseIdx + 1];
        var srcA = truthTable[baseIdx + 2];
        var idxB = truthTable[baseIdx + 3];
        var srcB = truthTable[baseIdx + 4];

        inA = srcA == 0 ? outputs[idxA] : intermediates[idxA];

        if (op == 2) { // NOT
            intermediates[opIdx] <== 1 - inA;
        } else {
            inB = srcB == 0 ? outputs[idxB] : intermediates[idxB];

            if (op == 0) { // AND
                intermediates[opIdx] <== inA * inB;
            } else if (op == 1) { // OR
                intermediates[opIdx] <== inA + inB - inA * inB;
            }
        }
    }

    // Step 3: Final output = last intermediate
    resultOut <== intermediates[nLogicGates-1];
}

// Declare your main component
//((a==b) OR (c==d)) AND (e≤f≤g) AND ((h ∈ [i,j,k,l]) OR (hash of x matches expected)) AND (signature is valid)
component main {public [isEqualA, rangeCheckValue, membershipCheckValue, hashVerificationPreimage, signatureVerificationMessage ]} = BusinessLogic(
    [2, 1, 1, 1, 1],        // Operations: 2 IsEqual, 1 RangeCheck, 1 MembershipCheck, 1 HashVerifier, 1 SignatureVerifier
    [0, 32, 4, 512, 256],   // Params: (0) for IsEqual, (32-bit) for RangeCheck, (4-member set) for MembershipCheck, (512-bit hash) for HashVerifier, (256-bit signature) for SignatureVerifier
    5,                     // Total logic gates = 5
    [
        // Gate 0: I0 = (a == b) OR (c == d)
        1, 0, 0, 1, 0,       // OR(outputs[0], outputs[1])

        // Gate 1: I1 = I0 AND (e ≤ f ≤ g)
        0, 0, 1, 2, 0,       // AND(intermediates[0], outputs[2])

        // Gate 2: I2 = (h ∈ [i,j,k,l]) OR (hash of x matches expected)
        1, 3, 0, 4, 0,       // OR(outputs[3], outputs[4])

        // Gate 3: I3 = I1 AND I2
        0, 1, 1, 2, 1,       // AND(intermediates[1], intermediates[2])

        // Gate 4: I4 = I3 AND (signature is valid)
        0, 3, 1, 5, 0        // AND(intermediates[3], outputs[5])
    ]
);