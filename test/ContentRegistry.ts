import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";

const KIND = { Article: 0, Image: 1 };
const hashOf = (label: string) => ethers.sha256(ethers.toUtf8Bytes(label));
const URI = "https://example.com/a";

async function deployFixture() {
  const [owner, alice, bob, carol] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory("ContentRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  return { registry, owner, alice, bob, carol };
}

async function registeredFixture() {
  const f = await deployFixture();
  await f.registry.connect(f.alice).register(hashOf("v0"), URI, KIND.Article);
  return f; // content id 1, author alice
}

describe("ContentRegistry", () => {
  describe("register / lookup", () => {
    it("registers content with author, kind, version 0, time and uri", async () => {
      const { registry, alice } = await loadFixture(deployFixture);
      const h = hashOf("hello");
      await expect(registry.connect(alice).register(h, URI, KIND.Image))
        .to.emit(registry, "Registered")
        .withArgs(1, alice.address, h, KIND.Image, URI);

      const [author, kind, count] = await registry.getContent(1);
      expect(author).to.equal(alice.address);
      expect(kind).to.equal(KIND.Image);
      expect(count).to.equal(1);

      const v = await registry.getVersion(1, 0);
      expect(v.hash).to.equal(h);
      expect(v.uri).to.equal(URI);
      expect(v.timestamp).to.be.greaterThan(0);
      expect(v.attestCount).to.equal(0);
      expect(v.disputeCount).to.equal(0);
      expect(await registry.latestHash(1)).to.equal(h);
      expect(await registry.versionCount(1)).to.equal(1);
    });

    it("gives increasing ids starting at 1", async () => {
      const { registry, alice, bob } = await loadFixture(deployFixture);
      await registry.connect(alice).register(hashOf("a"), URI, KIND.Article);
      await registry.connect(bob).register(hashOf("b"), URI, KIND.Article);
      expect((await registry.getContent(2)).author).to.equal(bob.address);
    });

    it("lookup finds a registered hash and not an unknown one", async () => {
      const { registry } = await loadFixture(registeredFixture);
      expect(await registry.lookup(hashOf("v0"))).to.deep.equal([true, 1n, 0n]);
      expect(await registry.lookup(hashOf("nope"))).to.deep.equal([false, 0n, 0n]);
    });

    it("reverts on a duplicate hash, from the same or another wallet", async () => {
      const { registry, alice, bob } = await loadFixture(registeredFixture);
      await expect(registry.connect(alice).register(hashOf("v0"), URI, 0)).to.be.revertedWith("Hash already registered");
      await expect(registry.connect(bob).register(hashOf("v0"), URI, 0)).to.be.revertedWith("Hash already registered");
    });

    it("reverts on a zero hash, empty link or oversized link", async () => {
      const { registry, alice } = await loadFixture(deployFixture);
      await expect(registry.connect(alice).register(ethers.ZeroHash, URI, 0)).to.be.revertedWith("Hash is empty");
      await expect(registry.connect(alice).register(hashOf("x"), "", 0)).to.be.revertedWith("Link is required");
      await expect(registry.connect(alice).register(hashOf("x"), "a".repeat(513), 0)).to.be.revertedWith("Link is too long");
      await registry.connect(alice).register(hashOf("x"), "a".repeat(512), 0); // exactly at the limit
    });

    it("reverts reads for a nonexistent content or version", async () => {
      const { registry } = await loadFixture(registeredFixture);
      await expect(registry.getContent(0)).to.be.revertedWith("Content does not exist");
      await expect(registry.getContent(2)).to.be.revertedWith("Content does not exist");
      await expect(registry.getVersion(2, 0)).to.be.revertedWith("Content does not exist");
      await expect(registry.getVersion(1, 1)).to.be.revertedWith("Version does not exist");
      await expect(registry.versionCount(2)).to.be.revertedWith("Content does not exist");
      await expect(registry.latestHash(2)).to.be.revertedWith("Content does not exist");
    });
  });

  describe("update", () => {
    it("appends a version, keeps old ones and the author", async () => {
      const { registry, alice } = await loadFixture(registeredFixture);
      await expect(registry.connect(alice).update(1, hashOf("v1"), "https://example.com/b"))
        .to.emit(registry, "Updated")
        .withArgs(1, 1, hashOf("v1"), "https://example.com/b");

      expect(await registry.versionCount(1)).to.equal(2);
      expect(await registry.latestHash(1)).to.equal(hashOf("v1"));
      expect((await registry.getVersion(1, 0)).hash).to.equal(hashOf("v0"));
      expect((await registry.getVersion(1, 0)).uri).to.equal(URI);
      expect((await registry.getContent(1)).author).to.equal(alice.address);
      expect(await registry.lookup(hashOf("v0"))).to.deep.equal([true, 1n, 0n]);
      expect(await registry.lookup(hashOf("v1"))).to.deep.equal([true, 1n, 1n]);
    });

    it("keeps versions in order with non-decreasing times", async () => {
      const { registry, alice } = await loadFixture(registeredFixture);
      await registry.connect(alice).update(1, hashOf("v1"), URI);
      await registry.connect(alice).update(1, hashOf("v2"), URI);
      const t0 = (await registry.getVersion(1, 0)).timestamp;
      const t1 = (await registry.getVersion(1, 1)).timestamp;
      const t2 = (await registry.getVersion(1, 2)).timestamp;
      expect(t1).to.be.gte(t0);
      expect(t2).to.be.gte(t1);
    });

    it("reverts for a non-author", async () => {
      const { registry, bob } = await loadFixture(registeredFixture);
      await expect(registry.connect(bob).update(1, hashOf("v1"), URI)).to.be.revertedWith("Not the author");
    });

    it("reverts for a nonexistent id", async () => {
      const { registry, alice } = await loadFixture(registeredFixture);
      await expect(registry.connect(alice).update(9, hashOf("v1"), URI)).to.be.revertedWith("Content does not exist");
    });

    it("reverts when the hash is already used by any content or version, even the author's own earlier one", async () => {
      const { registry, alice, bob } = await loadFixture(registeredFixture);
      await registry.connect(bob).register(hashOf("bobs"), URI, 0); // id 2
      await expect(registry.connect(alice).update(1, hashOf("v0"), URI)).to.be.revertedWith("Hash already registered");
      await expect(registry.connect(alice).update(1, hashOf("bobs"), URI)).to.be.revertedWith("Hash already registered");
    });

    it("reverts on a zero hash, empty link or oversized link", async () => {
      const { registry, alice } = await loadFixture(registeredFixture);
      await expect(registry.connect(alice).update(1, ethers.ZeroHash, URI)).to.be.revertedWith("Hash is empty");
      await expect(registry.connect(alice).update(1, hashOf("v1"), "")).to.be.revertedWith("Link is required");
      await expect(registry.connect(alice).update(1, hashOf("v1"), "a".repeat(513))).to.be.revertedWith("Link is too long");
    });
  });

  describe("attest", () => {
    it("counts attests and disputes from different wallets", async () => {
      const { registry, alice, bob, carol } = await loadFixture(registeredFixture);
      await expect(registry.connect(alice).attest(1, 0, true))
        .to.emit(registry, "Attested")
        .withArgs(1, 0, alice.address, true); // the author may attest their own content
      await registry.connect(bob).attest(1, 0, true);
      await registry.connect(carol).attest(1, 0, false);

      const v = await registry.getVersion(1, 0);
      expect(v.attestCount).to.equal(2);
      expect(v.disputeCount).to.equal(1);
      expect(await registry.hasVoted(1, 0, bob.address)).to.equal(true);
    });

    it("starts a new version at 0/0, keeps old counts, and lets the same wallet vote again", async () => {
      const { registry, alice, bob } = await loadFixture(registeredFixture);
      await registry.connect(bob).attest(1, 0, true);
      await registry.connect(alice).update(1, hashOf("v1"), URI);

      const fresh = await registry.getVersion(1, 1);
      expect(fresh.attestCount).to.equal(0);
      expect(fresh.disputeCount).to.equal(0);
      expect(await registry.hasVoted(1, 1, bob.address)).to.equal(false);

      await registry.connect(bob).attest(1, 1, false);
      expect((await registry.getVersion(1, 0)).attestCount).to.equal(1);
      expect((await registry.getVersion(1, 1)).disputeCount).to.equal(1);
    });

    it("reverts on a second vote on the same version, same or opposite choice", async () => {
      const { registry, bob } = await loadFixture(registeredFixture);
      await registry.connect(bob).attest(1, 0, true);
      await expect(registry.connect(bob).attest(1, 0, true)).to.be.revertedWith("Already voted on this version");
      await expect(registry.connect(bob).attest(1, 0, false)).to.be.revertedWith("Already voted on this version");
      expect((await registry.getVersion(1, 0)).attestCount).to.equal(1);
    });

    it("reverts for a nonexistent id or version", async () => {
      const { registry, bob } = await loadFixture(registeredFixture);
      await expect(registry.connect(bob).attest(2, 0, true)).to.be.revertedWith("Content does not exist");
      await expect(registry.connect(bob).attest(1, 1, true)).to.be.revertedWith("Version does not exist");
    });
  });

  describe("gas (informational, for the frontend gas limits)", () => {
    it("reports gas used per write", async () => {
      const { registry, alice, bob } = await loadFixture(deployFixture);
      const r = await (await registry.connect(alice).register(hashOf("g"), URI, 0)).wait();
      const u = await (await registry.connect(alice).update(1, hashOf("g1"), URI)).wait();
      const a = await (await registry.connect(bob).attest(1, 1, true)).wait();
      const long = "a".repeat(512);
      const rl = await (await registry.connect(alice).register(hashOf("gl"), long, 0)).wait();
      const ul = await (await registry.connect(alice).update(2, hashOf("gl1"), long)).wait();
      console.log(`      gas used: register=${r!.gasUsed} update=${u!.gasUsed} attest=${a!.gasUsed}`);
      console.log(`      worst case (512-byte link): register=${rl!.gasUsed} update=${ul!.gasUsed}`);
    });
  });
});
