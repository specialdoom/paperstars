// Asking the player to confirm something, in the game's own dialog rather than the
// browser's: `ask` shows it and resolves to whether they agreed.

export interface Question {
	title: string;
	message: string;
	/** Label of the button that agrees. */
	confirm: string;
	cancel?: string;
	/** The action cannot be undone, so its button is shown as a warning. */
	danger?: boolean;
}

interface Asked extends Question {
	id: number;
	resolve: (yes: boolean) => void;
}

let asked = $state.raw<Asked | null>(null);
let nextId = 0;

/** The question being asked right now, if any. */
export function currentQuestion() {
	return asked;
}

export function ask(question: Question): Promise<boolean> {
	// a question still open is answered no, so the new one takes its place
	asked?.resolve(false);
	return new Promise((resolve) => {
		asked = { ...question, id: nextId++, resolve };
	});
}

/** Answers question `id`, unless another one has replaced it meanwhile. */
export function answer(id: number, yes: boolean) {
	if (asked?.id !== id) return;
	const { resolve } = asked;
	asked = null;
	resolve(yes);
}
