/** Une couleur stable par personnage : la même dans la liste, le badge et le surlignage. */

const COLORS = ['#6D4BF5', '#E0518A', '#1F9D6B', '#E07A1F', '#2F86D6', '#9B3FD1', '#C9A227', '#D6455C'];

export const NARRATOR_COLOR = '#8A82A6';

export function colorForKey(key) {
  if (!key || key === '__narrateur__') return NARRATOR_COLOR;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}
