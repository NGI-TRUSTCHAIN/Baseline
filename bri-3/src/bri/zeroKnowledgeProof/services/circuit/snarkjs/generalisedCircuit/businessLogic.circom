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
}

// Declare your main component
component main = BusinessLogic(nIsEqual, nLessThan, n, nOps, truthTable, numInputsPerRow);

