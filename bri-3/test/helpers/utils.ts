export async function waitForTreeUpdate(
  bpiService,
  bpiAccountId,
  maxTries = 50,
  delay = 20000,
) {
  for (let i = 0; i < maxTries; i++) {
    const result = await bpiService.fetchBpiAccount(bpiAccountId);
    console.log('Result Tree: ', result.stateTree.tree);

    const tree = JSON.parse(result?.stateTree?.tree);
    const leaves = tree?.leaves;

    const hasLeaves = Array.isArray(leaves) && leaves.length > 0;
    if (hasLeaves) {
      console.log('Leaves detected, returning result.');
      return result;
    }

    console.log(`[Retry ${i + 1}] Tree not yet updated. Waiting ${delay}ms...`);
    await new Promise((r) => setTimeout(r, delay));
  }

  throw new Error('State tree was not updated after maximum retries');
}
