pragma circom 2.1.5;
include "../../../../../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../../../../../node_modules/circomlib/circuits/mux1.circom";
include "../../../../../../../node_modules/circomlib/circuits/gates.circom";
include "../utils/rangeCheck.circom"

//TODO: Issue #29
//TODO: Issue #30
//TODO: Issue #31
//TODO: Issue #32
//TODO: Issue #33
//TODO: Issue #34

/**
 * This circuit runs business logic by combining multiple operations 
 * (equality, lessThan, greaterThan, range check, membership check, 
 * hash verification, merkle proof verification, signature verification, etc) using
 * logic gates defined in a truth table (AND, OR, NOT, etc.).
 * 
 * @param ops - Array of business logic operations to perform. ops[0] = Number of IsEqual operations, ops[1] = Number of Range check operations.
 * @param n - Determines the bit width considered when performing the LessThan operation.
 * @param nLogicGates - Number of logic gate operations to perform (AND, OR, NOT).
 * @param truthTable - Defines sequence and inputs of logic gates for combining results of business logic operations (equality, lessThan, etc.).
 * Each row in the truth table contains:
 * 1. The logic gate to use (0 = AND, 1 = OR, 2 = NOT).
 * 2. The index of the first input to use.
 * 3. The source of the first input (0 for output, 1 for intermediate).
 * 4. The index of the second input to use.
 * 5. The source of the second input (0 for output, 1 for intermediate).
 * @param numInputsPerRow - Number of inputs per row in the inputs array.
 * 
 * 
 * @param inputs - A 2D array of inputs, where each row contains the inputs for the business logic operations (isEqual, LessThan, etc).
 * The first row contains the inputs for the IsEqual operations, and the second row contains the inputs for the LessThan operations.
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
    component isEquals[ops[0]];
    component RangeChecks[ops[1]];

    // Outputs from operations
    signal outputs[ops[0] + ops[1]];
    signal intermediates[nLogicGates];

    // Step 1: Get outputs of IsEqual and LessThan operations
    for (var i = 0; i < ops[0]; i++) {
        isEquals[i] = IsEqual();
        isEquals[i].in[0] <== inputs[0][2*i];
        isEquals[i].in[1] <== inputs[0][2*i+1];
        outputs[i] <== isEquals[i].out;
    }

    for (var j = 0; j < ops[1]; j++) {
        rangeChecks[j] = RangeCheck(n);
        rangeChecks[j].x <== inputs[1][3 * j];
        rangeChecks[j].min <== inputs[1][3 * j + 1];
        rangeChecks[j].max <== inputs[1][3 * j + 2];
        outputs[ops[0] + j] <== rangeChecks[j].isInRange;
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
    [2,       // nIsEqual: Number of IsEqual operations (a == b, c == d)
    1],       // nLessThan: Number of LessThan operations (e < f)
    32,      // n: Bit width for LessThan comparisons
    2,       // nLogicGates: Number of logic operations (OR, AND)
    [
        1, 0, 0, 1, 0,  // OR: outputs[0] OR outputs[1]
        0, 0, 1, 2, 0   // AND: intermediate[0] AND outputs[2]
    ],
    6        // numInputsPerRow: Inputs per sub-array in inputs[2][]
);


