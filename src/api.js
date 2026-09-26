export async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Request failed');
  return data;
}
