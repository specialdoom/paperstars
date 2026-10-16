// The game around the folding: every star that lands in the jar earns luck, which buys
// upgrades in the shop. Sealing a jar puts it on the shelf, where it keeps giving a
// little luck, and grants wishes, which unlock new patterns and jars.

import { JAR_SHAPES } from './jarShapes';
import { PATTERNS, type Pattern } from './strip';

const STORAGE_KEY = 'paperstars.game';
/** Where the jar keeps its stars; a save with stars in it predates locked patterns and jars. */
const OLD_JAR_KEY = 'paperstars.jar';

/** A star folded entirely by hand is worth this many times more, before Steady hands. */
const BASE_HAND_BONUS = 3;
/** Fewest stars a jar needs before it can be sealed. */
export const MIN_SEAL = 10;
/** A jar on the shelf gives back its luck over this many seconds, again and again. */
const SHELF_PAYBACK_SECONDS = 600;
/** Jars on the shelf that give luck, before any Bigger shelf. */
const BASE_SHELF_SLOTS = 3;
/** Colours kept from a sealed jar to draw it on the shelf. */
const SHELF_SWATCHES = 24;

export type Currency = 'luck' | 'wishes';

export interface Upgrade {
	id: 'paper' | 'hands' | 'gears' | 'shelf';
	name: string;
	text: string;
	currency: Currency;
	/** Price of the first level; each next one costs `growth` times more. */
	cost: number;
	growth: number;
	max?: number;
}

export const UPGRADES: Upgrade[] = [
	{
		id: 'paper',
		name: 'Better paper',
		text: 'Every star is worth 1 more luck.',
		currency: 'luck',
		cost: 20,
		growth: 1.6
	},
	{
		id: 'hands',
		name: 'Steady hands',
		text: 'Stars folded all by hand are worth 1 more times as much.',
		currency: 'luck',
		cost: 60,
		growth: 1.9
	},
	{
		id: 'gears',
		name: 'Auto-folder gears',
		text: 'Keep making stars rests less between stars.',
		currency: 'luck',
		cost: 30,
		growth: 1.45,
		max: 10
	},
	{
		id: 'shelf',
		name: 'Bigger shelf',
		text: 'One more sealed jar gives luck every second.',
		currency: 'wishes',
		cost: 4,
		growth: 2
	}
];

/** What unlocking each pattern and jar costs in wishes; those not listed are free. */
export const PATTERN_COST: Partial<Record<Pattern, number>> = { dots: 2, checks: 3, gradient: 4 };
export const SHAPE_COST: Partial<Record<string, number>> = { globe: 3, tube: 4, flask: 5 };

export interface SealedJar {
	shape: string;
	stars: number;
	luck: number;
	/** A sample of the stars' colours, to draw the jar with. */
	colors: string[];
	sealedAt: string;
}

interface Game {
	name: string;
	luck: number;
	wishes: number;
	levels: Record<Upgrade['id'], number>;
	patterns: Pattern[];
	shapes: string[];
	shelf: SealedJar[];
	stats: { folded: number; byHand: number; luckEarned: number };
}

function fresh(): Game {
	return {
		name: '',
		luck: 0,
		wishes: 0,
		levels: { paper: 0, hands: 0, gears: 0, shelf: 0 },
		patterns: PATTERNS.filter((pattern) => !PATTERN_COST[pattern]),
		shapes: JAR_SHAPES.filter((shape) => !SHAPE_COST[shape.id]).map((shape) => shape.id),
		shelf: [],
		stats: { folded: 0, byHand: 0, luckEarned: 0 }
	};
}

const isNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value >= 0;

function load(): Game {
	const game = fresh();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const saved = JSON.parse(raw ?? '{}') ?? {};
		const hadStars = JSON.parse(localStorage.getItem(OLD_JAR_KEY) ?? '[]')?.length > 0;
		// anyone who played before things had to be unlocked keeps all of them
		if (saved.version !== 2 && (isNumber(saved.luck) || hadStars)) {
			game.patterns = [...PATTERNS];
			game.shapes = JAR_SHAPES.map((shape) => shape.id);
		}
		if (typeof saved.name === 'string') game.name = saved.name.slice(0, 24);
		if (isNumber(saved.luck)) game.luck = saved.luck;
		if (isNumber(saved.wishes)) game.wishes = saved.wishes;
		for (const { id } of UPGRADES) {
			if (isNumber(saved.levels?.[id])) game.levels[id] = Math.floor(saved.levels[id]);
		}
		if (Array.isArray(saved.patterns)) {
			game.patterns = PATTERNS.filter((p) => saved.patterns.includes(p) || game.patterns.includes(p));
		}
		if (Array.isArray(saved.shapes)) {
			game.shapes = JAR_SHAPES.map((s) => s.id).filter(
				(id) => saved.shapes.includes(id) || game.shapes.includes(id)
			);
		}
		if (Array.isArray(saved.shelf)) {
			game.shelf = saved.shelf.filter(
				(jar: SealedJar) =>
					typeof jar?.shape === 'string' &&
					isNumber(jar.stars) &&
					isNumber(jar.luck) &&
					Array.isArray(jar.colors)
			);
		}
		for (const key of ['folded', 'byHand', 'luckEarned'] as const) {
			if (isNumber(saved.stats?.[key])) game.stats[key] = saved.stats[key];
		}
	} catch {
		// storage unavailable or unreadable: start from nothing
	}
	return game;
}

export const game = $state(load());

function save() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, ...game }));
	} catch {
		// storage unavailable: progress just won't persist
	}
}

/** How many times more a star folded all by hand is worth. */
export function handBonus() {
	return BASE_HAND_BONUS + game.levels.hands;
}

/** Luck a star earns when it lands in the jar. */
export function starWorth(byHand: boolean) {
	return (1 + game.levels.paper) * (byHand ? handBonus() : 1);
}

/** How long the auto-folder rests between stars. */
export function factoryRestMs() {
	return 4000 * 0.8 ** game.levels.gears;
}

/** Counts a star dropped in the jar and adds the luck it earned. */
export function earnStar(worth: number, byHand: boolean) {
	game.stats.folded += 1;
	if (byHand) game.stats.byHand += 1;
	earn(worth);
}

function earn(luck: number) {
	game.luck += luck;
	game.stats.luckEarned += luck;
	save();
}

export function price(upgrade: Upgrade) {
	return Math.round(upgrade.cost * upgrade.growth ** game.levels[upgrade.id]);
}

export function maxed(upgrade: Upgrade) {
	return upgrade.max !== undefined && game.levels[upgrade.id] >= upgrade.max;
}

function spend(currency: Currency, amount: number) {
	if (game[currency] < amount) return false;
	game[currency] -= amount;
	return true;
}

export function buy(upgrade: Upgrade) {
	if (maxed(upgrade) || !spend(upgrade.currency, price(upgrade))) return false;
	game.levels[upgrade.id] += 1;
	save();
	return true;
}

export function unlockPattern(pattern: Pattern) {
	if (game.patterns.includes(pattern) || !spend('wishes', PATTERN_COST[pattern] ?? 0)) return false;
	game.patterns = PATTERNS.filter((p) => p === pattern || game.patterns.includes(p));
	save();
	return true;
}

export function unlockShape(id: string) {
	if (game.shapes.includes(id) || !spend('wishes', SHAPE_COST[id] ?? 0)) return false;
	game.shapes = JAR_SHAPES.map((s) => s.id).filter((s) => s === id || game.shapes.includes(s));
	save();
	return true;
}

/** Wishes granted for sealing a jar holding `luck`. */
export function wishesFor(luck: number) {
	return Math.floor(Math.sqrt(luck / 5));
}

/** Puts a jar of stars on the shelf and grants its wishes. */
export function seal(shape: string, stars: { colorA: string; colorB: string; worth: number }[]) {
	if (stars.length < MIN_SEAL) return 0;
	const luck = stars.reduce((sum, star) => sum + star.worth, 0);
	const every = Math.max(1, Math.floor(stars.length / SHELF_SWATCHES));
	game.shelf.push({
		shape,
		stars: stars.length,
		luck,
		colors: stars
			.filter((_, i) => i % every === 0)
			.slice(0, SHELF_SWATCHES)
			.flatMap((star) => [star.colorA, star.colorB]),
		sealedAt: new Date().toISOString()
	});
	const wishes = wishesFor(luck);
	game.wishes += wishes;
	save();
	return wishes;
}

/** How many sealed jars give luck. */
export function shelfSlots() {
	return BASE_SHELF_SLOTS + game.levels.shelf;
}

/** The sealed jars that give luck: the richest ones, as many as the shelf has room for. */
export function earningJars() {
	return [...game.shelf].sort((a, b) => b.luck - a.luck).slice(0, shelfSlots());
}

/** Luck a sealed jar gives every second while it is one of the earning ones. */
export function jarLuckPerSecond(jar: SealedJar) {
	return jar.luck / SHELF_PAYBACK_SECONDS;
}

export function luckPerSecond() {
	return earningJars().reduce((sum, jar) => sum + jarLuckPerSecond(jar), 0);
}

/** Adds what the shelf earned over `seconds`. */
export function tick(seconds: number) {
	const luck = luckPerSecond() * seconds;
	if (luck > 0) earn(luck);
}

export function rename(name: string) {
	game.name = name.trim().slice(0, 24);
	save();
}

/** Who the stars belong to, for labels. */
export function owner() {
	return game.name ? `${game.name}'s` : 'Your';
}

/** Forgets everything: luck, wishes, upgrades, the shelf and the jar. */
export function resetGame() {
	try {
		for (const key of Object.keys(localStorage)) {
			if (key.startsWith('paperstars.')) localStorage.removeItem(key);
		}
	} catch {
		// storage unavailable: nothing was saved anyway
	}
	location.reload();
}
