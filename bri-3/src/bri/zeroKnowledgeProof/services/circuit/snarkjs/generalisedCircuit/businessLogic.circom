pragma circom 2.1.5;
include "../../../../../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../../../../../node_modules/circomlib/circuits/mux1.circom";
include "../../../../../../../node_modules/circomlib/circuits/gates.circom";
include "../utils/rangeCheck.circom";
include "../utils/membershipCheck.circom";

//TODO: Issue #29
//TODO: Issue #30
//TODO: Issue #31
//TODO: Issue #32
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
 * @param nInputs - Total number of inputs to the circuit.
 * 
 * 
 * @param inputs - Array of inputs to the circuit.
 *
 *
 *
 * @returns True/False after verifying the business logic.
 */
template BusinessLogic(
    businessOperations, businessOperationParams, nLogicGates, truthTable, nInputs
){

   // Input & final result
    signal input inputs[nInputs];
    signal output resultOut;

    // Components for operations   
    // 0: IsEqual
    var nIsEqual = businessOperations[0];
    var inputsPerIsEqual = 2;
    var IsEqualParam = businessOperationParams[0];
    component isEquals[nIsEqual];

    //1: RangeCheck
    var nRangeCheck = businessOperations[1];
    var inputsPerRangeCheck = 3;
    var RangeCheckParam = businessOperationParams[1];
    component rangeChecks[nRangeCheck];
    
    //2: MembershipCheck
    var nMembershipCheck = businessOperations[2];
    var inputsPerMembershipCheck = 1 + businessOperationParams[2];
    var MembershipCheckParam = businessOperationParams[2];
    component membershipChecks[nMembershipCheck];

    //3: Hash verification
    // var nHashVerification = businessOperations[3];
    // var inputsPerHashVerification = 2;
    // var HashVerificationParam = businessOperationParams[3];

    // //4: Signature verification
    // var nSignatureVerification = businessOperations[4];
    // var inputsPerSignatureVerification = 2;
    // var SignatureVerificationParam = businessOperationParams[4]; 

    // Outputs from operations
    signal outputs[nIsEqual + nRangeCheck + nMembershipCheck];
    signal intermediates[nLogicGates];

    //Index for the inputs and output array
    var inputIndex = 0;
    var outputIndex = 0;

    // Step 1: Get outputs of Business operations
    for (var i = 0; i < nIsEqual; i++) {
        isEquals[i] = IsEqual();
        isEquals[i].in[0] <== inputs[inputIndex];
        isEquals[i].in[1] <== inputs[inputIndex + 1];
        outputs[outputIndex] <== isEquals[i].out;
        inputIndex += inputsPerIsEqual;
        outputIndex++;
    }

    for (var j = 0; j < nRangeCheck; j++) {
        rangeChecks[j] = RangeCheck(RangeCheckParam);   
        rangeChecks[j].x <== inputs[inputIndex];
        rangeChecks[j].min <== inputs[inputIndex + 1];
        rangeChecks[j].max <== inputs[inputIndex + 2];
        outputs[outputIndex] <== rangeChecks[j].isInRange;
        inputIndex += inputsPerRangeCheck;
        outputIndex++;
    }

    for (var k = 0; k < nMembershipCheck; k++) {
        membershipChecks[k] = MembershipCheck(MembershipCheckParam);
        membershipChecks[k].x <== inputs[inputIndex];
        for (var l = 0; l < MembershipCheckParam; l++) {
            membershipChecks[k].values[l] <== inputs[inputIndex + 1 + l];
        }
        outputs[outputIndex] <== membershipChecks[k].isMember;
        inputIndex += inputsPerMembershipCheck;
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
component main = BusinessLogic(
    [2, 1, 1],        // businessOperations: 2 IsEqual, 1 RangeCheck, 1 MembershipCheck
    [0, 32, 4],        // businessOperationParams: 0 for eq, 32 bit width, 4 values for membership
    3,                // nLogicGates: 3 gates (OR, AND, AND)
    [1,0,0,1,0,       // Gate0: inter0 = eq1 OR eq2
     0,0,1,2,0,       // Gate1: inter1 = inter0 AND rangeCheck
     0,1,1,3,0],      // Gate2: inter2 = inter1 AND membership
    12                // Total inputs: eq+ range + membership = (2+2)+(3)+(1+4) = 12
);


