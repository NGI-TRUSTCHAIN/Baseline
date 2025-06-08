const hre = require('hardhat');

async function main() {
  const [originalOwner] = await hre.ethers.getSigners();

  // use internal bpi subject account as the owner of the CcsmBpiStateAnchor contract
  const ownerAndAdminPrivateKey =
    '2c95d82bcd8851bd3a813c50afafb025228bf8d237e8fd37ba4adba3a7596d58';
  const ownerAndAdmin = new hre.ethers.Wallet(
    ownerAndAdminPrivateKey,
    hre.ethers.provider,
  );

  await originalOwner.sendTransaction({
    to: ownerAndAdmin.address,
    value: hre.ethers.parseEther('1.0'),
  });

  const CcsmBpiStateAnchor =
    await hre.ethers.getContractFactory('CcsmBpiStateAnchor');

  const ccsmBpiStateAnchor = await CcsmBpiStateAnchor.connect(
    ownerAndAdmin,
  ).deploy([ownerAndAdmin.address, ownerAndAdmin.address]);

  console.log(
    'CcsmBpiStateAnchor deployed to:',
    await ccsmBpiStateAnchor.getAddress(),
  );

  // deploy necessary contracts--> all contract names under hardhat project must be unique regardless of the folder structure
  //All contracts must be precompiled to be able to deploy them
  const RomaniaWorkstep1Verifier = await hre.ethers.getContractFactory(
    'RomaniaWorkstep1Verifier',
  );

  const romaniaWorkstep1Verifier = await RomaniaWorkstep1Verifier.deploy();

  console.log(
    'RomaniaWorkstep1Verifier deployed to:',
    await romaniaWorkstep1Verifier.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
