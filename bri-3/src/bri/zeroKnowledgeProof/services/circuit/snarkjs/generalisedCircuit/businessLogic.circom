pragma circom 2.1.5;
include "../../../../../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../../../../../node_modules/circomlib/circuits/mux1.circom";
include "../../../../../../../node_modules/circomlib/circuits/gates.circom";

/**
 * This circuit runs business logic by combining multiple operations 
 * (equality, lessThan, greaterThan, range check, membership check, 
 * hash verification, merkle proof verification, signature verification, etc) using
 * operations defined in a truth table (AND, OR, NOT, etc.).
 * @param nIsEqual - Number of IsEqual operations to perform.
 * @param nLessThan - Number of LessThan operations to perform.
 * @param n - Determines the bit width considered when performing the LessThan operation.
 * @param nOps - Number of types of operations to perform (AND, OR, NOT) when combining outputs of multiple operations.
 * @param truthTable - A table that defining how to combine the outputs of the multiple operations (business logic).
 * @param numInputsPerRow - Number of inputs per row in the inputs array.
 * @returns True/False after verifying the business logic.
 */
template BusinessLogic(
    nIsEqual, nLessThan, n, nOps, truthTable, numInputsPerRow
) {

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
    for (var opIdx = 0; opIdx < nOps; opIdx++) {
        var baseIdx = 5 * opIdx;
        var op = truthTable[baseIdx];
        var idxA = truthTable[baseIdx + 1];
        var srcA = truthTable[baseIdx + 2];
        var idxB = truthTable[baseIdx + 3];
        var srcB = truthTable[baseIdx + 4];

        signal inA;
        if (srcA == 0) {
            inA <== outputs[idxA];
        } else {
            inA <== intermediates[idxA];
        }

        // Use circomlib components for logical operations
        if (op == 2) { // NOT
            component notGate = NOT();  // Create NOT gate from circomlib
            notGate.in <== inA;         // Assign input
            intermediates[opIdx] <== notGate.out;  // Get the output
        } else {
            signal inB;
            if (srcB == 0) {
                inB <== outputs[idxB];
            } else {
                inB <== intermediates[idxB];
            }

            if (op == 0) { // AND
                component andGate = AND();  // Create AND gate from circomlib
                andGate.a <== inA;           // First input
                andGate.b <== inB;           // Second input
                intermediates[opIdx] <== andGate.out;  // Get the output
            } else if (op == 1) { // OR
                component orGate = OR();  // Create OR gate from circomlib
                orGate.a <== inA;          // First input
                orGate.b <== inB;          // Second input
                intermediates[opIdx] <== orGate.out;  // Get the output
            }
        }
    } 
}

// Declare your main component
component main = BusinessLogic(nIsEqual, nLessThan, n, nOps, truthTable, numInputsPerRow);

