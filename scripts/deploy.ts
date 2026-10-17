import { ethers } from "hardhat";

async function main() {
  console.log("Deploying Greeter to Monad testnet...");

  // Grab the compiled contract factory and deploy it.
  // Pass constructor arguments here if your contract needs them.
  const Greeter = await ethers.getContractFactory("Greeter");
  const greeter = await Greeter.deploy("Hello, Monad!");

  // Wait until the deployment transaction is mined.
  await greeter.waitForDeployment();

  const address = await greeter.getAddress();
  console.log("Greeter deployed to:", address);
  console.log("\nNext step: paste this address into frontend/src/config.ts");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
