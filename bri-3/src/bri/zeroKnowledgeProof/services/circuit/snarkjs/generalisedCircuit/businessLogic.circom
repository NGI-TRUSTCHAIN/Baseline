pragma circom 2.1.5;
include "../../../../../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../../../../../node_modules/circomlib/circuits/mux1.circom";
include "../../../../../../../node_modules/circomlib/circuits/gates.circom";
include "../utils/rangeCheck.circom";

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
 * @param ops - Array of business logic operations to perform. 
 * ops = [
    nIsEqual, inputsPerIsEqual,   // e.g., 2 inputs per IsEqual op
    nRangeCheck, inputsPerRangeCheck   // e.g., 3 inputs per RangeCheck op]
 * @param n - Determines the bit width considered when performing the RangeCheck operation.
 * @param nLogicGates - Number of logic gate operations to perform (AND, OR, NOT).
 * @param truthTable - Defines sequence and inputs of logic gates for combining results of business logic operations (equality, RangeCheck, etc.).
 * Each row in the truth table contains:
 * 1. The logic gate to use (0 = AND, 1 = OR, 2 = NOT).
 * 2. The index of the first input to use.
 * 3. The source of the first input (0 for output, 1 for intermediate).
 * 4. The index of the second input to use.
 * 5. The source of the second input (0 for output, 1 for intermediate).
 * @param numInputsPerRow - Number of inputs per row in the inputs array.
 * 
 * 
 * @param inputs - A 2D array of inputs, where each row contains the inputs for the business logic operations (isEqual, RangeCheck, etc).
 * The first row contains the inputs for the IsEqual operations, and the second row contains the inputs for the RangeCheck operations.
 *
 *
 *
 * @returns True/False after verifying the business logic.
 */
template BusinessLogic(
    ops, n, nLogicGates, truthTable, numInputsPerRow
){

   // Input & final result
    signal input inputs[2][numInputsPerRow];
    signal output resultOut;

    // Components for operations
    var nIsEqual = ops[0];
    var inputsPerIsEqual = ops[1];
    var nRangeCheck = ops[2];
    var inputsPerRangeCheck = ops[3];
    
    component isEquals[nIsEqual];
    component rangeChecks[nRangeCheck];

    // Outputs from operations
    signal outputs[nIsEqual + nRangeCheck];
    signal intermediates[nLogicGates];

    // Step 1: Get outputs of IsEqual and Range Check operations
    for (var i = 0; i < nIsEqual; i++) {
        isEquals[i] = IsEqual();
        isEquals[i].in[0] <== inputs[0][inputsPerIsEqual*i];
        isEquals[i].in[1] <== inputs[0][inputsPerIsEqual*i+1];
        outputs[i] <== isEquals[i].out;
    }

    for (var j = 0; j < nRangeCheck; j++) {
        rangeChecks[j] = RangeCheck(n);
        rangeChecks[j].x <== inputs[1][inputsPerRangeCheck * j];
        rangeChecks[j].min <== inputs[1][inputsPerRangeCheck * j + 1];
        rangeChecks[j].max <== inputs[1][inputsPerRangeCheck * j + 2];
        outputs[nIsEqual + j] <== rangeChecks[j].isInRange;
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
    [2, 2,      // nIsEqual, inputsPerIsEqual, 
    1, 3],       // nRangeCheck, inputsPerRangeCheck
    32,      // n: Bit width for Range Check  operation comparisons
    2,       // nLogicGates: Number of logic operations (OR, AND)
    [
        1, 0, 0, 1, 0,  // OR: outputs[0] OR outputs[1]
        0, 0, 1, 2, 0   // AND: intermediate[0] AND outputs[2]
    ],
    4        // numInputsPerRow: Inputs per sub-array in inputs[2][]
);


