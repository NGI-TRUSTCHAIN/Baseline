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
 * @param truthTableRows - Number of rows in the truth table.
 * @param numInputsPerRow - Number of inputs per row in the inputs array.
 * @param inputs - A 2D array of inputs, where each row contains the inputs for the operations (isEqual, LessThan, etc).
 * @param truthTable - A table that defining how to combine the outputs of the multiple operations (business logic).
 * @returns True/False after verifying the business logic.
 */
template BusinessLogic(
    nIsEqual, nLessThan, n, truthTableRows, numInputsPerRow
) {

   // Input & final result
    signal input inputs[2][numInputsPerRow];
    signal input truthTable[truthTableRows][5];
    signal output resultOut;

    // Components for operations
    component isEquals[nIsEqual];
    component lessThans[nLessThan];

    // Outputs from operations
    signal outputs[nIsEqual + nLessThan];
    signal intermediates[truthTableRows];

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
    for (var logicOpIdx = 0; logicOpIdx < truthTableRows; logicOpIdx++) {
        var op = truthTable[logicOpIdx][0];
        var idxA = truthTable[logicOpIdx][1];
        var srcA = truthTable[logicOpIdx][2];
        var idxB = truthTable[logicOpIdx][3];
        var srcB = truthTable[logicOpIdx][4];

        signal inA;
        if (srcA == 0) {
            inA <== outputs[idxA];
        } else {
            inA <== intermediates[idxA];
        }

        if (op == 2) { // NOT Gate
            component notGate = NOT();
            notGate.in <== inA;        
            intermediates[logicOpIdx] <== notGate.out;
        } else {
            signal inB;
            if (srcB == 0) {
                inB <== outputs[idxB];
            } else {
                inB <== intermediates[idxB];
            }

            if (op == 0) { // AND Gate
                component andGate = AND();  
                andGate.a <== inA;           
                andGate.b <== inB;           
                intermediates[logicOpIdx] <== andGate.out;  
            } else if (op == 1) { // OR Gate
                component orGate = OR();  
                orGate.a <== inA;          
                orGate.b <== inB;          
                intermediates[logicOpIdx] <== orGate.out;  
            }
        }
    } 

    // Step 3: Final output = last intermediate
    var resultIdx = truthTableRows - 1;
    resultOut <== intermediates[resultIdx];
}

// Declare your main component
component main = BusinessLogic(nIsEqual, nLessThan, n, truthTableRows, numInputsPerRow);

