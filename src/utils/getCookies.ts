export default function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const last = parts.pop();
    if (last) {
      return last.split(';').shift() ?? null;
    }
  }
  return null;
}