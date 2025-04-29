pragma circom 2.1.5;
include "../../../../../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../../../../../node_modules/circomlib/circuits/mux1.circom";
include "../../../../../../../node_modules/circomlib/circuits/gates.circom";

template BusinessLogic(
    nIsEqual, nLessThan, n, nOps, truthTable, numInputsPerRow
) {
    
}

// Declare your main component
component main = BusinessLogic(nIsEqual, nLessThan, n, nOps, truthTable, numInputsPerRow);

