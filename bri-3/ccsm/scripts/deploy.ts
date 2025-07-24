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

  // deploy verifier contracts for 3 worksteps from the e2e use-case.
  // in practice, they would be deployed by however is setting up the workflow
  // and only contract addresses would be added to the workstep
  const Workstep1Verifier = await hre.ethers.getContractFactory(
    'contracts/sriWorkgroup/workstep1Verifier.sol:PlonkVerifier',
  );

  const workstep1Verifier = await Workstep1Verifier.deploy();

  console.log(
    'Workstep1Verifier deployed to:',
    await workstep1Verifier.getAddress(),
  );

  const Workstep2Verifier = await hre.ethers.getContractFactory(
    'contracts/sriWorkgroup/workstep2Verifier.sol:PlonkVerifier',
  );

  const workstep2Verifier = await Workstep2Verifier.deploy();

  console.log(
    'Workstep2Verifier deployed to:',
    await workstep2Verifier.getAddress(),
  );

  const Workstep3Verifier = await hre.ethers.getContractFactory(
    'contracts/sriWorkgroup/workstep3Verifier.sol:PlonkVerifier',
  );

  const workstep3Verifier = await Workstep3Verifier.deploy();

  console.log(
    'Workstep3Verifier deployed to:',
    await workstep3Verifier.getAddress(),
  );

  //Romania Workstep 1

  const RomaniaWorkstep1Verifier = await hre.ethers.getContractFactory(
    'contracts/originationWorkgroup/romania_workstep1Verifier.sol:PlonkVerifier',
  );

  const romaniaWorkstep1Verifier = await RomaniaWorkstep1Verifier.deploy();

  console.log(
    'RomaniaWorkstep1Verifier deployed to:',
    await romaniaWorkstep1Verifier.getAddress(),
  );

  //Serbia Workstep 1
  const SerbiaWorkstep1Verifier = await hre.ethers.getContractFactory(
    'contracts/originationWorkgroup/serbia_workstep1Verifier.sol:PlonkVerifier',
  );

  const serbiaWorkstep1Verifier = await SerbiaWorkstep1Verifier.deploy();

  console.log(
    'SerbiaWorkstep1Verifier deployed to:',
    await serbiaWorkstep1Verifier.getAddress(),
  );

  //Serbia Workstep 2
  const SerbiaWorkstep2Verifier = await hre.ethers.getContractFactory(
    'contracts/originationWorkgroup/serbia_workstep2Verifier.sol:PlonkVerifier',
  );

  const serbiaWorkstep2Verifier = await SerbiaWorkstep2Verifier.deploy();

  console.log(
    'SerbiaWorkstep2Verifier deployed to:',
    await serbiaWorkstep2Verifier.getAddress(),
  );

  //Serbia Workstep 3
  const SerbiaWorkstep3Verifier = await hre.ethers.getContractFactory(
    'contracts/originationWorkgroup/serbia_workstep3Verifier.sol:PlonkVerifier',
  );

  const serbiaWorkstep3Verifier = await SerbiaWorkstep3Verifier.deploy();

  console.log(
    'SerbiaWorkstep3Verifier deployed to:',
    await serbiaWorkstep3Verifier.getAddress(),
  );

  //Serbia Workstep 4
  const SerbiaWorkstep4Verifier = await hre.ethers.getContractFactory(
    'contracts/originationWorkgroup/serbia_workstep4Verifier.sol:PlonkVerifier',
  );

  const serbiaWorkstep4Verifier = await SerbiaWorkstep4Verifier.deploy();

  console.log(
    'SerbiaWorkstep4Verifier deployed to:',
    await serbiaWorkstep4Verifier.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
