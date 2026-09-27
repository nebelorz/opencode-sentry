export type FetchLike = (url: string) => Promise<Response>;

export async function fetchHtml(url: string, fetchImpl: FetchLike = fetch): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch ${url}: ${reason}`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`);
  }

  return response.text();
}
