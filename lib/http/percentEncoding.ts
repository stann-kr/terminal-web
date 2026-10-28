/** 경로의 percent-encoding이 깨져 decodeURIComponent가 throw하면 true. 라우트가 500 대신 404를 내도록 middleware에서 쓴다. */
export function hasMalformedPercentEncoding(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return false;
  } catch {
    return true;
  }
}
