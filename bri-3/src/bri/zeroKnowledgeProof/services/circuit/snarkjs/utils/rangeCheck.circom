pragma circom 2.1.5;

include "circomlib/circuits/comparators.circom";

template RangeCheck(n) {
    signal input x;
    signal input min;
    signal input max;
    signal output isInRange;

    component gteMin = GreaterThan(n);
    component lteMax = LessThan(n);

    signal minMinus1;
    signal maxPlus1;

    minMinus1 <== min - 1;
    maxPlus1 <== max + 1;

    gteMin.in[0] <== x;
    gteMin.in[1] <== minMinus1;

    lteMax.in[0] <== x;
    lteMax.in[1] <== maxPlus1;

    // isInRange <== gteMin.out * lteMax.out;
    isInRange <== gteMin.out * lteMax.out;

}

component main = RangeCheck(32);
