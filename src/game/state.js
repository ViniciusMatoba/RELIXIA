const SAVE_KEY = 'relixia-save';

const DEFAULT_STATE = {
  gold: 200,
  heroes: [],
  pets: [],
  inventory: [],
  materials: {},
  activeDungeon: 'leaf-village',
  bossKills: 0,
  totalKills: 0,
};

export let state = load();

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch (_) {}
  return { ...DEFAULT_STATE };
}

export function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(SAVE_KEY);
  Object.assign(state, { ...DEFAULT_STATE });
}
