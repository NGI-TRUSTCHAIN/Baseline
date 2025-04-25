pragma circom 2.1.5;
include "../../../../../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../../../../../node_modules/circomlib/circuits/mux1.circom";


//TODO: Add other operations (rangecheck, membership check, hash verification, signature verification, etc.)
//TODO: Expand inputs array to support multiple inputs
//TODO: Use input bitmask to select the operation

//This circuit selects between two operations: equality check and less than check.
//It uses a multiplexer to select the output based on the selected operation.
template BusinessLogic(n){
	signal input inputs[2][2];
        signal input checkSelector;

        signal output resultOut;

        component isEqual = IsEqual();
        isEqual.in[0] <== inputs[0][0];
        isEqual.in[1] <== inputs[0][1];

        component lessThan = LessThan(n);
        lessThan.in[0] <== inputs[1][0];
        lessThan.in[1] <== inputs[1][1];

        //TODO: Use Mux2 or Mux3 for multiple selectors
        component mux = Mux1();

        mux.c[0] <== lessThan.out;
        mux.c[1] <== isEqual.out;
        mux.s <== checkSelector;

        resultOut <== mux.out;
}


//TODO: Add multiple selectors for different operations
component main {public [inputs, checkSelector]} = BusinessLogic(32);