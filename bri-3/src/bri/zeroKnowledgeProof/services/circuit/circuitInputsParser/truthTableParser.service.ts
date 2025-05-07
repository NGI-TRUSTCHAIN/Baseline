type TruthTableRow = [number, number, number, number, number];

const AND = 0;
const OR = 1;
const NOT = 2;
const XOR = 3;
const NAND = 4;
const NOR = 5;

// Helper function to create a truth table row
function createRow(
  op: number,
  srcA: number,
  idxA: number,
  srcB: number,
  idxB: number,
): TruthTableRow {
  return [op, srcA, idxA, srcB, idxB];
}

// Function to process operators
const operatorPrecedence: { [key: string]: number } = {
  not: 3,
  and: 2,
  or: 1,
  xor: 1,
  nand: 1,
  nor: 1,
};

// Helper function to evaluate the expression recursively
function parseExpression(expression: string): TruthTableRow[] {
  const tokens = tokenize(expression);
  const operatorStack: string[] = [];
  const operandStack: string[] = [];
  const truthTable: TruthTableRow[] = [];
  const intermediateIndex = 0;

  // Process the tokens one by one
  for (const token of tokens) {
    if (token === '(') {
      // Handle opening parentheses (recursive case)
      operatorStack.push(token);
    } else if (token === ')') {
      // Handle closing parentheses
      while (operatorStack[operatorStack.length - 1] !== '(') {
        processOperator(
          operatorStack,
          operandStack,
          truthTable,
          intermediateIndex,
        );
      }
      operatorStack.pop(); // Remove '('
    } else if (isOperator(token)) {
      // Handle operators
      while (
        operatorStack.length > 0 &&
        operatorPrecedence[operatorStack[operatorStack.length - 1]] >=
          operatorPrecedence[token]
      ) {
        processOperator(
          operatorStack,
          operandStack,
          truthTable,
          intermediateIndex,
        );
      }
      operatorStack.push(token);
    } else {
      // Operand (variable like A, B, etc.)
      operandStack.push(token);
    }
  }

  // Process any remaining operators
  while (operatorStack.length > 0) {
    processOperator(operatorStack, operandStack, truthTable, intermediateIndex);
  }

  return truthTable;
}

// Tokenizer function to split the expression into words
function tokenize(expression: string): string[] {
  return expression.match(/\w+|[()]/g) || [];
}

// Helper function to determine if a token is an operator
function isOperator(token: string): boolean {
  return ['and', 'or', 'not', 'xor', 'nand', 'nor'].includes(token);
}

// Function to process operators and generate the truth table
function processOperator(
  operatorStack: string[],
  operandStack: string[],
  truthTable: TruthTableRow[],
  intermediateIndex: number,
) {
  const operator = operatorStack.pop()!;
  const operandB = operandStack.pop();
  const operandA = operandStack.pop();

  if (operator === 'not') {
    const row = createRow(NOT, 1, parseInt(operandA!), 0, 0);
    truthTable.push(row);
    operandStack.push((intermediateIndex++).toString());
  } else {
    const opType =
      operator === 'and'
        ? AND
        : operator === 'or'
        ? OR
        : operator === 'xor'
        ? XOR
        : operator === 'nand'
        ? NAND
        : NOR;

    const row = createRow(
      opType,
      0,
      parseInt(operandA!),
      0,
      parseInt(operandB!),
    );
    truthTable.push(row);
    operandStack.push((intermediateIndex++).toString());
  }
}

// Function to generate a truth table from an expression
function generateTruthTable(expression: string): TruthTableRow[] {
  return parseExpression(expression);
}

// Test the function with more complex expressions
const expression = '((A and B) or (C and (not D)))';
const truthTable = generateTruthTable(expression);
console.log(JSON.stringify(truthTable, null, 2));
