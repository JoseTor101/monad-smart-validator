import { ethers } from "hardhat";

async function main() {
  console.log("Deploying ContentRegistry to Monad testnet...");

  const Registry = await ethers.getContractFactory("ContentRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("ContentRegistry deployed to:", address);
  console.log("\nNext step: paste this address into frontend/src/config.ts");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
