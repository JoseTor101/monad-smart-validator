import type { SealState } from "./components";

// Representative content used when contracts are not yet deployed, so the UI
// is fully demoable. Once REGISTRY_ADDRESS is set, views read live chain data
// and ignore this.

export interface SamplePost {
  id: number;
  title: string;
  description: string;
  author: string;
  topic: string; // slug matching config TOPICS
  kind: "Article" | "Image";
  hash: string;
  createdAt: number; // unix seconds
  versions: number;
  reputation: number; // aggregate validation reputation 0-100
  seal: SealState;
  yesWeight: number;
  noWeight: number;
}

const now = Math.floor(Date.now() / 1000);

export const SAMPLE_POSTS: SamplePost[] = [
  {
    id: 7,
    title: "Inside the grid: how a city rebuilt its water telemetry",
    description:
      "A six-month field report on sensor networks replacing manual meter reads, with the raw datasets attached and hashed at publication.",
    author: "0x9A3f21C7b4De5082aF1c0bE4471Dd9e3C2b70a5E",
    topic: "journalism",
    kind: "Article",
    hash: "0x8f2a1c93be77d4e5a0b1c2d3e4f50617a8b9c0d1e2f3041526378490abcdef12",
    createdAt: now - 3600 * 5,
    versions: 3,
    reputation: 88,
    seal: "verified",
    yesWeight: 142,
    noWeight: 11,
  },
  {
    id: 6,
    title: "Saltmarsh at first light",
    description:
      "Original long-exposure capture, registered straight from the camera roll. Perceptual-hash neighbours flagged none.",
    author: "0x4D7b11aa98C3E7F0126bB4590aC2dE81F03a6B22",
    topic: "photography",
    kind: "Image",
    hash: "0x1b4d7e0a2f9c3851d6e7b8a90c1d2e3f405162738495a6b7c8d9e0f1a2b3c4d5",
    createdAt: now - 3600 * 26,
    versions: 1,
    reputation: 71,
    seal: "verified",
    yesWeight: 64,
    noWeight: 9,
  },
  {
    id: 5,
    title: "A replication of the 2024 perovskite stability results",
    description:
      "Independent lab notes and measurements. Submitted for peer validation under the research topic; two reviewers contest the humidity controls.",
    author: "0xC1a2B3c4D5e6F7081920A3B4c5D6e7F809112233",
    topic: "research",
    kind: "Article",
    hash: "0x90ab12cd34ef5678019283a4b5c6d7e8f90112233445566778899aabbccddeeff",
    createdAt: now - 3600 * 50,
    versions: 2,
    reputation: 44,
    seal: "contested",
    yesWeight: 38,
    noWeight: 33,
  },
  {
    id: 4,
    title: "Generative study no. 12 — lattice bloom",
    description:
      "Declared derivative of study no. 9, with the seed and parameter file hashed. Linked to its parent in the provenance graph.",
    author: "0x7E8f9a0B1c2D3e4F5061728394a5B6c7D8e9F001",
    topic: "art",
    kind: "Image",
    hash: "0x5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6071829a0b1",
    createdAt: now - 3600 * 73,
    versions: 1,
    reputation: 59,
    seal: "pending",
    yesWeight: 0,
    noWeight: 0,
  },
  {
    id: 3,
    title: "The case against engagement metrics as a public good",
    description:
      "Opinion essay. A challenger disputed the originality claim; an escalated validation round is now open at double stake.",
    author: "0x2233445566778899AaBbCcDdEeFf001122334455",
    topic: "opinion",
    kind: "Article",
    hash: "0xaa11bb22cc33dd44ee55ff6677889900a1b2c3d4e5f60718293a4b5c6d7e8f90",
    createdAt: now - 3600 * 120,
    versions: 4,
    reputation: 31,
    seal: "disputed",
    yesWeight: 51,
    noWeight: 77,
  },
];

// Per-topic counts for the discovery bento.
export function topicCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of SAMPLE_POSTS) counts[p.topic] = (counts[p.topic] ?? 0) + 1;
  return counts;
}

export const SAMPLE_PROFILE = {
  reputation: 73,
  registered: 12,
  validations: 48,
  disputesWon: 3,
  txs: [
    { kind: "Registered content", detail: "#7 — water telemetry report", hash: "0x8f2a1c93be77d4e5", when: "5h ago" },
    { kind: "Validated (yes)", detail: "Round #21 · journalism", hash: "0x3c91ddee21fa0045", when: "6h ago" },
    { kind: "Withdrew reward", detail: "+2.4 MON from round #18", hash: "0x77ddbb5512ef90aa", when: "1d ago" },
    { kind: "Opened round", detail: "#19 on content #6 · photography", hash: "0x1b4d7e0a2f9c3851", when: "1d ago" },
    { kind: "Disputed", detail: "Round #14 → escalated #17", hash: "0xaa11bb22cc33dd44", when: "3d ago" },
  ],
};
