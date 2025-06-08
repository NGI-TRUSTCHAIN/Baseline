pragma circom 2.1.5;

include "../../../../../../../node_modules/circomlib/circuits/comparators.circom";

template MembershipCheck(n) {
    signal input x;
    signal input values[n]; // The allowed values
    signal output isMember;

    signal matches[n];

    component isEquals[n];

    for (var i = 0; i < n; i++) {
        isEquals[i] = IsEqual();
        isEquals[i].in[0] <== x;
        isEquals[i].in[1] <== values[i];
        matches[i] <== isEquals[i].out;
    }

    var sum = 0;
    for (var j = 0; j < n; j++) {
        sum = sum + matches[j];
    }

    // If x matches any of the values, sum == 1 → isMember = 1
    // Multiple matches are allowed, so sum >= 1 also means true
    component isZero = IsEqual();
    isZero.in[0] <== sum;
    isZero.in[1] <== 0;
    isMember <== 1 - isZero.out;
}
