export function assetUrl(fileName: string): string {
  const base = (import.meta.env.BASE_URL || './').replace(/\/?$/, '/');
  const clean = fileName.replace(/^\/+/, '');
  return `${base}${clean}`;
}
