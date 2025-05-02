pragma circom 2.1.5;
include "../../../../../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../../../../../node_modules/circomlib/circuits/mux1.circom";
include "../../../../../../../node_modules/circomlib/circuits/gates.circom";

/**
 * This circuit runs business logic by combining multiple operations 
 * (equality, lessThan, greaterThan, range check, membership check, 
 * hash verification, merkle proof verification, signature verification, etc) using
 * logic gates defined in a truth table (AND, OR, NOT, etc.).
 * 
 * @param nIsEqual - Number of IsEqual operations.
 * @param nLessThan - Number of LessThan operations.
 * @param n - Determines the bit width considered when performing the LessThan operation.
 * @param nOps - Number of logic gate operations to perform (AND, OR, NOT).
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
    nIsEqual, nLessThan, n, nOps, truthTable, numInputsPerRow
){

   // Input & final result
    signal input inputs[2][numInputsPerRow];
    signal output resultOut;

    // Components for operations
    component isEquals[nIsEqual];
    component lessThans[nLessThan];

    // Outputs from operations
    signal outputs[nIsEqual + nLessThan];
    signal intermediates[nOps];

    // Step 1: Get outputs of IsEqual and LessThan operations
    for (var i = 0; i < nIsEqual; i++) {
        isEquals[i] = IsEqual();
        isEquals[i].in[0] <== inputs[0][2*i];
        isEquals[i].in[1] <== inputs[0][2*i+1];
        outputs[i] <== isEquals[i].out;
    }

    for (var j = 0; j < nLessThan; j++) {
        lessThans[j] = LessThan(n);
        lessThans[j].in[0] <== inputs[1][2*j];
        lessThans[j].in[1] <== inputs[1][2*j+1];
        outputs[nIsEqual + j] <== lessThans[j].out;
    }

    // Step 2: Flexible logic combining using circomlib gates (AND, OR, NOT)
    var inA;
    var inB;

    for (var opIdx = 0; opIdx < nOps; opIdx++) {
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
    resultOut <== intermediates[nOps-1];
}

// Declare your main component
component main = BusinessLogic(
    2,       // nIsEqual: Number of IsEqual operations (a == b, c == d)
    1,       // nLessThan: Number of LessThan operations (e < f)
    32,      // n: Bit width for LessThan comparisons
    2,       // nOps: Number of logic operations (OR, AND)
    [
        1, 0, 0, 1, 0,  // intermediate[0] = (outputs[0] OR outputs[1])
        0, 0, 1, 2, 0   // intermediate[1] = intermediate[0] AND outputs[2]
    ],
    4        // numInputsPerRow: Inputs per sub-array in inputs[2][]
);


