// The game around the folding: every star that lands in the jar earns luck,
// and how much depends on how the star was made.

const STORAGE_KEY = 'paperstars.game';

/** What a plain star folded by the machine is worth. */
const BASE_WORTH = 1;
/** A star folded entirely by hand is worth this many times more. */
export const HAND_BONUS = 3;

function load() {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
		if (typeof saved?.luck === 'number' && saved.luck >= 0) return { luck: saved.luck };
	} catch {
		// storage unavailable or unreadable: start from nothing
	}
	return { luck: 0 };
}

export const game = $state(load());

/** Luck a star earns when it lands in the jar. */
export function starWorth(byHand: boolean) {
	return BASE_WORTH * (byHand ? HAND_BONUS : 1);
}

export function earn(luck: number) {
	game.luck += luck;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
	} catch {
		// storage unavailable: the luck just won't persist
	}
}
