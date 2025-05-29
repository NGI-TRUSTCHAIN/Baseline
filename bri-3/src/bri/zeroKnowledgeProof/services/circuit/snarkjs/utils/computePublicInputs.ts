import { Signature } from 'ethers';
import { computeEffEcdsaPubInput } from '@personaelabs/spartan-ecdsa';
import { ec as EC } from 'elliptic';
import { ethers } from 'ethers';
import { Transaction } from '../../../../../transactions/models/transaction';
import MerkleTree from 'merkletreejs';
import { MerkleTree as FixedMerkleTree } from 'fixed-merkle-tree';
import * as crypto from 'crypto';
import { buildBabyjub, buildEddsa } from 'circomlibjs';
import 'dotenv/config';
import { PublicKeyType } from '../../../../../identity/bpiSubjects/models/publicKey';
import { createHash } from 'crypto';
import { ed25519 } from '@noble/curves/ed25519';
import * as circomlib from 'circomlibjs';

export const computeEffectiveEcdsaSigPublicInputs = (
  signature: Signature,
  msgHash: Buffer,
  publicKeyHex: string,
) => {
  const ec = new EC('secp256k1');

  //Public Key
  const publicKeyBuffer = ethers.toBeArray(publicKeyHex);
  const publicKeyCoordinates = ec.keyFromPublic(publicKeyBuffer).getPublic();

  //Signature
  const r = BigInt(signature.r);
  const circuitPubInput = computeEffEcdsaPubInput(
    r,
    BigInt(signature.v),
    msgHash,
  );
  const input = {
    signature: BigInt(signature.s),
    Tx: circuitPubInput.Tx,
    Ty: circuitPubInput.Ty,
    Ux: circuitPubInput.Ux,
    Uy: circuitPubInput.Uy,
    publicKeyX: publicKeyCoordinates.getX().toString(),
    publicKeyY: publicKeyCoordinates.getY().toString(),
  };

  return input;
};

export const computeEcdsaSigPublicInputs = (tx: Transaction) => {
  const ecdsaSignature = ethers.Signature.from(tx.signature);

  const messageHash = Buffer.from(
    ethers.toBeArray(ethers.hashMessage(tx.payload)),
  );

  const publicKey = tx.fromBpiSubjectAccount.ownerBpiSubject.publicKeys.filter(
    (key) => key.type == PublicKeyType.ECDSA,
  )[0].value;

  return computeEffectiveEcdsaSigPublicInputs(
    ecdsaSignature,
    Buffer.from(messageHash),
    publicKey,
  );
};

export const computeMerkleProofPublicInputs = (
  merkelizedPayload: MerkleTree,
  stateTree: MerkleTree,
) => {
  const sha256Hash = (left: any, right: any) =>
    crypto
      .createHash(`${process.env.MERKLE_TREE_HASH_ALGH}`)
      .update(`${left}${right}`)
      .digest('hex');
  const ZERO_ELEMENT =
    '21663839004416932945382355908790599225266501822907911457504978515578255421292';

  const merkelizedInvoiceHashedLeaves = merkelizedPayload.getHexLeaves();
  const merkelizedInvoicelevels = Math.ceil(
    Math.log2(merkelizedInvoiceHashedLeaves.length),
  );

  const fixedMerkelizedInvoice = new FixedMerkleTree(
    merkelizedInvoicelevels,
    merkelizedInvoiceHashedLeaves,
    {
      hashFunction: sha256Hash,
      zeroElement: ZERO_ELEMENT,
    },
  );

  const stateTreeHexLeaves = stateTree.getHexLeaves();
  const stateTreelevels = Math.ceil(Math.log2(stateTreeHexLeaves.length));
  const fixedStateTree = new FixedMerkleTree(
    stateTreelevels,
    stateTreeHexLeaves,
    {
      hashFunction: sha256Hash,
      zeroElement: ZERO_ELEMENT,
    },
  );

  const { pathElements, pathIndices } = fixedStateTree.path(0);

  return {
    merkelizedInvoiceRoot: fixedMerkelizedInvoice.root,
    stateTreeRoot: fixedStateTree.root,
    stateTree: pathElements,
    stateTreeLeafPosition: pathIndices,
  };
};

export const computeEddsaSigPublicInputs = async (tx: Transaction) => {
  const eddsa = await buildEddsa();

  const hashedPayload = crypto
    .createHash(`${process.env.MERKLE_TREE_HASH_ALGH}`)
    .update(JSON.stringify(tx.payload))
    .digest();

  const publicKey = tx.fromBpiSubjectAccount.ownerBpiSubject.publicKeys.filter(
    (key) => key.type == PublicKeyType.EDDSA,
  )[0].value;

  const packedPublicKey = new Uint8Array(Buffer.from(publicKey, 'hex'));

  const signature = Uint8Array.from(Buffer.from(tx.signature, 'hex'));
  const unpackedSignature = eddsa.unpackSignature(signature);

  const packedSignature = eddsa.packSignature(unpackedSignature);

  const messageBits = buffer2bitsLSB(hashedPayload);
  const r8Bits = buffer2bitsLSB(Buffer.from(packedSignature.slice(0, 32)));
  const sBits = buffer2bitsLSB(Buffer.from(packedSignature.slice(32, 64)));
  const aBits = buffer2bitsLSB(Buffer.from(packedPublicKey));

  const inputs = {
    message: messageBits,
    A: aBits,
    R8: r8Bits,
    S: sBits,
  };

  return inputs;
};

//This gives least-significant-bit (LSB) first order.
export const buffer2bitsLSB = (buffer: Buffer) => {
  const res: bigint[] = [];
  for (let i = 0; i < buffer.length; i++) {
    for (let j = 0; j < 8; j++) {
      if ((buffer[i] >> j) & 1) {
        res.push(BigInt(1));
      } else {
        res.push(BigInt(0));
      }
    }
  }
  return res;
};

//This gives most-significant-bit (MSB) first order.
export function buffer2bitsMSB(b: Buffer) {
  const res: number[] = [];
  for (let i = 0; i < b.length; i++) {
    for (let j = 0; j < 8; j++) {
      res.push((b[i] >> (7 - j)) & 1);
    }
  }
  return res;
}

export function is256BitBinaryString(str: string): boolean {
  return str.length === 256 && /^[01]+$/.test(str);
}
export function LeafToBits(leaf: string, bitPadding: number): number[] {
  let leafStrBuffer = Buffer.from(leaf, 'utf8');
  const paddedLength = bitPadding / 8;
  if (leafStrBuffer.length < paddedLength) {
    const padding = Buffer.alloc(paddedLength - leafStrBuffer.length, 0); // zero padding
    leafStrBuffer = Buffer.concat([leafStrBuffer, padding]);
  } else if (leafStrBuffer.length > paddedLength) {
    // If the leaf is longer than 32 bytes, truncate it
    leafStrBuffer = leafStrBuffer.slice(0, paddedLength);
  }

  const leafBits = buffer2bitsMSB(leafStrBuffer);
  return leafBits;
}
function bitsToBuffer(bits: number[]): Buffer {
  const byteArray: number[] = []; // 👈 Fix here
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | (bits[i + j] || 0); // MSB first
    }
    byteArray.push(byte);
  }
  return Buffer.from(byteArray);
}

export const generateMerkleHash = (left: string, right: string) => {
  //CONVERTING LEAF TO BIT
  let leftBits;
  let rightBits;

  if (!is256BitBinaryString(left)) {
    leftBits = LeafToBits(left, 256);
  } else {
    leftBits = left.split('').map(Number);
  }
  if (!is256BitBinaryString(right)) {
    rightBits = LeafToBits(right, 256);
  } else {
    rightBits = right.split('').map(Number);
  }

  //Concatenate the two bit arrays
  const totalBits = leftBits.concat(rightBits);

  //Convert totalBits to Buffer
  const totalBitsBuffer = bitsToBuffer(totalBits); //512

  //Generate hash string
  const hashStr = createHash('sha256').update(totalBitsBuffer).digest('hex');

  //Convert hash string to bits array
  const expectedHash = buffer2bitsMSB(Buffer.from(hashStr, 'hex'));

  return expectedHash.join('');
};

//Generate hash inputs
export const generateHashInputs = async (message: ArrayBuffer) => {
  let testStrBuffer = Buffer.from(message);
  //Check the length of the string and pad with 0s if less than 512 bits
  // Pad with zeros to reach 64 bytes (512 bits)
  const paddedLength = 64;
  if (testStrBuffer.length < paddedLength) {
    const padding = Buffer.alloc(paddedLength - testStrBuffer.length, 0); // zero padding
    testStrBuffer = Buffer.concat([testStrBuffer, padding]);
  }

  const preimage = buffer2bitsMSB(testStrBuffer);

  //Expected hash string
  const hashStr = createHash('sha256').update(testStrBuffer).digest('hex');
  const hashStrBuffer = Buffer.from(hashStr, 'hex');
  const expectedHash = buffer2bitsMSB(hashStrBuffer);
  return {
    preimage,
    expectedHash,
  };
};

export function flattenMerkleProofPathElement(
  merkleProofPathElement: number[][],
): number[] {
  return merkleProofPathElement.flat();
  // Flatten [depth][256] into [depth * 256]
}

export function generateMerkleProofInputs(leaf: string, tree: string[]) {
  const height = calculateMerkleTreeHeight(tree);
  const merkleTree = new FixedMerkleTree(height, tree, {
    hashFunction: generateMerkleHash,
    zeroElement: '0',
  });
  const path = merkleTree.proof(leaf);
  const merkleProofLeaf = LeafToBits(leaf, 256);
  const merkleProofRoot = String(merkleTree.root).split('').map(Number);
  const merkleProofPathElement = flattenMerkleProofPathElement(
    path.pathElements.map((node) => {
      let nodeBits;
      if (!is256BitBinaryString(String(node))) {
        nodeBits = LeafToBits(String(node), 256);
      } else {
        nodeBits = String(node).split('').map(Number);
      }
      return nodeBits;
    }),
  );
  const merkleProofPathIndex = path.pathIndices;

  return {
    merkleProofLeaf,
    merkleProofRoot,
    merkleProofPathElement,
    merkleProofPathIndex,
  };
}

function calculateMerkleTreeHeight(tree: string[]) {
  if (tree.length == 0) {
    throw new Error('Number of leaves must be greater than 0');
  }
  return Math.ceil(Math.log2(tree.length));
}
export const base64ToHash = (base64: string): string => {
  const buffer = Buffer.from(base64, 'base64');
  return buffer.toString('hex');
};

//Generate signature inputs
export const generateSignatureInputs = async (message: string) => {
  const msg = createHash('sha256').update(message).digest();
  const eddsa = await circomlib.buildEddsa();
  const babyJub = await circomlib.buildBabyjub();
  const privateKey = ed25519.utils.randomPrivateKey(); // or hardcode a fixed one
  const publicKey = eddsa.prv2pub(privateKey);
  const publicKeyPoints = eddsa.prv2pub(privateKey);
  const packedPublicKey = babyJub.packPoint(publicKeyPoints);
  const signature = eddsa.signPedersen(privateKey, msg);
  const packedSignature = eddsa.packSignature(signature);

  const messageBits = buffer2bitsLSB(msg);
  const r8Bits = buffer2bitsLSB(Buffer.from(packedSignature.slice(0, 32)));
  const sBits = buffer2bitsLSB(Buffer.from(packedSignature.slice(32, 64)));
  const aBits = buffer2bitsLSB(Buffer.from(packedPublicKey));
  return {
    messageBits,
    r8Bits,
    sBits,
    aBits,
  };
};
