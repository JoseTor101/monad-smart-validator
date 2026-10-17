import { ethers } from "hardhat";

// Speed demo: send N registrations back to back with sequential nonces and report confirm times.
// Usage: REGISTRY_ADDRESS=0x... npx hardhat run scripts/demo-burst.ts --network monadTestnet
const COUNT = Number(process.env.COUNT ?? 10);

async function main() {
  const address = process.env.REGISTRY_ADDRESS;
  if (!address) throw new Error("Set REGISTRY_ADDRESS to the deployed ContentRegistry address");

  const [signer] = await ethers.getSigners();
  const registry = await ethers.getContractAt("ContentRegistry", address, signer);
  let nonce = await signer.getNonce("pending");
  const stamp = Date.now();
  const start = Date.now();

  const sent = [];
  for (let i = 0; i < COUNT; i++) {
    const hash = ethers.sha256(ethers.toUtf8Bytes(`demo ${stamp} #${i}`));
    const tx = await registry.register(hash, `https://example.com/demo/${stamp}/${i}`, 0, {
      gasLimit: 300_000n,
      nonce: nonce++,
    });
    sent.push(tx);
  }

  let done = 0;
  await Promise.all(
    sent.map(async (tx, i) => {
      await tx.wait();
      console.log(`#${i} confirmed after ${((Date.now() - start) / 1000).toFixed(2)} s (${++done}/${COUNT})`);
    })
  );
  console.log(`\n${COUNT} registrations confirmed in ${((Date.now() - start) / 1000).toFixed(2)} s`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
