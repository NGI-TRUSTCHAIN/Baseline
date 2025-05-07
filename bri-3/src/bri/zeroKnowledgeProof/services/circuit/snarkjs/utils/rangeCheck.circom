pragma circom 2.1.5;

include "circomlib/circuits/comparators.circom";

template RangeCheck(n) {
    signal input x;
    signal input min;
    signal input max;
    signal output isInRange;

    // x >= min → x > min - 1
    component gteMin = GreaterThan(n);
    signal minMinus1;
    minMinus1 <== min - 1;
    gteMin.in[0] <== x;
    gteMin.in[1] <== minMinus1;

    // x <= max → x < max + 1
    component lteMax = LessThan(n);
    signal maxPlus1;
    maxPlus1 <== max + 1;
    lteMax.in[0] <== x;
    lteMax.in[1] <== maxPlus1;

    // Final condition: x ∈ [min, max]
    isInRange <== gteMin.out * lteMax.out;
}

component main = RangeCheck(32);
