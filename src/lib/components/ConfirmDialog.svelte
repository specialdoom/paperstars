<script lang="ts">
	import { answer, currentQuestion } from '#lib/confirm.svelte.ts';

	// The one confirmation dialog of the game, shown whenever something calls `ask`.

	let dialog: HTMLDialogElement;
	const question = $derived(currentQuestion());

	// as it opens, a handful of sparkles like the one in the header are thrown out from behind it
	const SPARKS = 18;
	const COLORS = ['#ffd77a', '#ff8ad8', '#8fe9ff', '#ffffff', '#c9a4ff'];
	const sparks = $derived(
		question
			? Array.from({ length: SPARKS }, (_, i) => {
					const angle = ((i + Math.random() * 0.6) / SPARKS) * Math.PI * 2;
					const reach = 170 + Math.random() * 150;
					return {
						x: Math.cos(angle) * reach * 1.3,
						y: Math.sin(angle) * reach,
						spin: (Math.random() - 0.5) * 720,
						size: 0.8 + Math.random() * 1.1,
						delay: Math.random() * 120,
						color: COLORS[i % COLORS.length]
					};
				})
			: []
	);

	$effect(() => {
		if (question && !dialog.open) dialog.showModal();
		else if (!question && dialog.open) dialog.close();
	});

	// closing it any way other than the confirm button, including Escape, is a no
	function onclose() {
		if (question) answer(question.id, dialog.returnValue === 'confirm');
		dialog.returnValue = '';
	}

	// a click on the dimmed page around it cancels
	function onclick(event: MouseEvent) {
		if (event.target === dialog) dialog.close('cancel');
	}
</script>

<dialog bind:this={dialog} {onclose} {onclick} aria-labelledby="confirm-title">
	{#if question}
		{#key question.id}
			<div class="burst" aria-hidden="true">
				{#each sparks as spark, i (i)}
					<span
						style:--x="{spark.x}px"
						style:--y="{spark.y}px"
						style:--spin="{spark.spin}deg"
						style:--delay="{spark.delay}ms"
						style:font-size="{spark.size}rem"
						style:color={spark.color}>✦</span
					>
				{/each}
			</div>
		{/key}
		<form method="dialog">
			<h2 id="confirm-title"><span aria-hidden="true">✦</span> {question.title}</h2>
			<p>{question.message}</p>
			<div class="buttons">
				<button type="submit" value="cancel">{question.cancel ?? 'Cancel'}</button>
				<!-- svelte-ignore a11y_autofocus -->
				<button
					type="submit"
					value="confirm"
					class:primary={!question.danger}
					class:danger={question.danger}
					autofocus={!question.danger}
				>
					{question.confirm}
				</button>
			</div>
		</form>
	{/if}
</dialog>

<style>
	dialog {
		width: min(26rem, calc(100vw - 2rem));
		padding: 1.4rem 1.5rem 1.2rem;
		border: 1px solid var(--panel-edge);
		border-radius: 20px;
		background:
			radial-gradient(ellipse at 15% 0%, rgba(255, 138, 216, 0.22), transparent 60%),
			radial-gradient(ellipse at 100% 100%, rgba(143, 233, 255, 0.16), transparent 55%),
			#1d1048;
		color: var(--ink);
		/* the sparkles fly out past its edges */
		overflow: visible;
		box-shadow:
			0 20px 60px rgba(8, 0, 40, 0.7),
			0 0 40px rgba(255, 138, 216, 0.25),
			inset 0 1px 0 rgba(255, 255, 255, 0.12);
	}

	dialog[open] {
		animation: appear 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.2);
	}

	dialog::backdrop {
		background: rgba(10, 4, 32, 0.6);
		backdrop-filter: blur(4px);
	}

	@keyframes appear {
		from {
			opacity: 0;
			transform: translateY(8px) scale(0.96);
		}
	}

	.burst {
		position: absolute;
		left: 50%;
		top: 50%;
		z-index: -1;
		pointer-events: none;
	}

	.burst span {
		position: absolute;
		line-height: 1;
		translate: -50% -50%;
		opacity: 0;
		text-shadow: 0 0 10px currentColor;
		animation: throw 1.1s cubic-bezier(0.15, 0.7, 0.3, 1) var(--delay) forwards;
	}

	@keyframes throw {
		0% {
			opacity: 0;
			/* from about the dialog's edge, so they never cross its text */
			transform: translate(calc(var(--x) * 0.55), calc(var(--y) * 0.55)) scale(0.3) rotate(0deg);
		}
		15% {
			opacity: 1;
		}
		70% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			/* out along its own direction, then dropping a little as it fades */
			transform: translate(var(--x), calc(var(--y) + 40px)) scale(1) rotate(var(--spin));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		dialog[open] {
			animation: none;
		}

		.burst {
			display: none;
		}
	}

	h2 {
		margin: 0 0 0.6rem;
		font-size: 1.25rem;
		background: linear-gradient(90deg, #ffd77a, #ff8ad8 60%, #c9a4ff);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}

	h2 span {
		-webkit-text-fill-color: var(--gold);
	}

	p {
		margin: 0;
		color: var(--muted);
		line-height: 1.5;
	}

	.buttons {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
		margin-top: 1.3rem;
	}

	.danger {
		background: linear-gradient(135deg, #ff7a9a, #ff4f8b);
		border-color: transparent;
		color: white;
		font-weight: 600;
		box-shadow: 0 0 14px rgba(255, 79, 139, 0.4);
	}
</style>
