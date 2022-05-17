import { Message } from '@open-wa/wa-automate';
import { Args, Module } from '../ModulesRegister';
import * as replies from './Messages';
import RaffleInstance from './RaffleInstance';

enum availableCommands {
	entrar,
	join,
	sair,
	quit,
	go,
	sortear,
	deletar,
	delete,
	sendError,
}

type CommandMap = {
	[key in keyof typeof availableCommands]: () => any;
};

class Raffle extends Module {
	raffles: RaffleInstance[];

	constructor() {
		super();
		this.raffles = [];
	}

	public create(args: Args) {
		const requester = this.requester as Message;
		const thing = args.immediate?.trim();
		try {
			const creatorID = requester.author;
			if (this.raffles.some(r => r.creatorID === creatorID))
				throw replies.raffleInUse();
			if (!thing) throw replies.noRaffleName();

			this.raffles.push(
				new RaffleInstance({
					creatorID,
					thing,
				})
			);

			this.registerPublicMethod({
				name: thing,
				method: this.raffleActions(thing),
			});
		} catch (e) {
			this.sendError(e, requester);
		}
	}

	private joinRaffle(thing: string, requester: Message) {
		const raffle = this.getRaffleByThing(thing);
		try {
			raffle.addParticipant(requester);
			this.zaplify?.replyAuthor(replies.raffleJoin(raffle), requester);
		} catch (e) {
			this.sendError(e, requester);
		}
	}

	private quitRaffle(thing: string, requester: Message) {
		const raffle = this.getRaffleByThing(thing);
		try {
			raffle.removeParticipant(requester);
			this.zaplify?.replyAuthor(replies.raffleQuit(raffle), requester);
		} catch (e) {
			this.sendError(e, requester);
		}
	}

	private deleteRaffle(thing: string, requester: Message) {
		const raffle = this.getRaffleByThing(thing);
		try {
			if (raffle.creatorID !== requester.author) throw replies.youAreNotTheOwner();
			this.raffles = this.raffles.filter(r => r.creatorID !== requester.author);
		} catch (e) {
			this.sendError(e, requester);
		}
	}

	private concludeRaffle(thing: string, requester: Message) {
		const raffle = this.getRaffleByThing(thing);
		try {
			if (raffle.creatorID !== requester.author) throw replies.youAreNotTheOwner();
			const winner = raffle.go();
			this.raffles = this.raffles.filter(r => r.creatorID !== requester.author);
			this.zaplify?.replyAuthor(replies.raffleWin(raffle), winner);
			this.removePublicMethod(raffle.thing);
		} catch (e) {
			this.sendError(e, requester);
		}
	}

	private getRaffleByThing(thing: string) {
		return this.raffles.filter(raffle => raffle.thing === thing)[0];
	}

	private raffleActions(thing: string) {
		return ((args: Args) => {
			const requester = this.requester as Message;
			const command = args.immediate?.trim() as keyof CommandMap;
			if (!command) throw replies.noCommand();

			const commandMap: CommandMap = {
				entrar: () => this.joinRaffle(thing, requester),
				join: () => this.joinRaffle(thing, requester),
				sair: () => this.quitRaffle(thing, requester),
				quit: () => this.quitRaffle(thing, requester),
				go: () => this.concludeRaffle(thing, requester),
				sortear: () => this.concludeRaffle(thing, requester),
				deletar: () => this.deleteRaffle(thing, requester),
				delete: () => this.deleteRaffle(thing, requester),
				sendError: () => this.sendError(replies.noCommand(), requester),
			};

			return commandMap[command]?.() || commandMap.sendError();
		}).bind(this);
	}

	private sendError(e: any, requester: Message) {
		return this.zaplify?.replyAuthor(JSON.stringify(e), requester);
	}
}

export default Raffle;