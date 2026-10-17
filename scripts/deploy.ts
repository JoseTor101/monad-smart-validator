import { ethers } from "hardhat";

async function main() {
  console.log("Deploying content-provenance contracts to Monad testnet...\n");

  // 1. Reputation registry (no constructor args).
  const Reputation = await ethers.getContractFactory("ReputationRegistry");
  const reputation = await Reputation.deploy();
  await reputation.waitForDeployment();
  const reputationAddr = await reputation.getAddress();
  console.log("ReputationRegistry:", reputationAddr);

  // 2. Content registry (no constructor args).
  const Registry = await ethers.getContractFactory("ContentRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("ContentRegistry:   ", registryAddr);

  // 3. Validation market, wired to both of the above.
  const Market = await ethers.getContractFactory("ValidationMarket");
  const market = await Market.deploy(reputationAddr, registryAddr);
  await market.waitForDeployment();
  const marketAddr = await market.getAddress();
  console.log("ValidationMarket:  ", marketAddr);

  // 4. Authorize the market as the only contract allowed to adjust reputation.
  //    This is a one-time, irreversible wiring step.
  const tx = await reputation.setMarket(marketAddr);
  await tx.wait();
  console.log("\nReputationRegistry.setMarket(ValidationMarket) confirmed.");

  console.log("\nPaste these into frontend/src/config.ts:");
  console.log(`  REPUTATION_ADDRESS = "${reputationAddr}"`);
  console.log(`  REGISTRY_ADDRESS   = "${registryAddr}"`);
  console.log(`  MARKET_ADDRESS     = "${marketAddr}"`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
