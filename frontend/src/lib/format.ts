export const short = (s: string, head = 6, tail = 4) =>
  s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;

export const formatTime = (unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleString();

export const kindLabel = (kind: number) => (kind === 1 ? "Image" : "Article");
