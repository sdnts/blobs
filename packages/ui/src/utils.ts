export const formatSize = (size: number): string => {
  // The font I'm using does not have lowercase letters lol, so avoid confusion
  // and just use Mb instead of MiB
  if (size < 1_000) return `${size} B`;
  if (size < 1_000_000) return `${(size / 1_000).toFixed(2)} KB`;
  if (size < 1_000_000_000) return `${(size / 1_000_000).toFixed(2)} MB`;
  if (size < 1_000_000_000_000)
    return `${(size / 1_000_000_000).toFixed(2)} GB`;
  else return `${(size / 1_000_000_000_000).toFixed(2)} TB`;
};
