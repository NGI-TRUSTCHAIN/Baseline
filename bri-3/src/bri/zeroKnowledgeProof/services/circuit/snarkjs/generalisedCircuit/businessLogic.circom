pragma circom 2.1.5;
include "../../../../../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../../../../../node_modules/circomlib/circuits/mux1.circom";
include "../../../../../../../node_modules/circomlib/circuits/gates.circom";

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
}

// Declare your main component
component main = BusinessLogic(nIsEqual, nLessThan, n, nOps, truthTable, numInputsPerRow);

