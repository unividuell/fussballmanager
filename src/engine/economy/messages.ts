import { newId, type ClubId, type GameState, type ManagerId, type Message } from "../model";

export const MESSAGE_LIMIT = 60;

export function postMessage(state: GameState, managerId: ManagerId, text: string, ref: Message["ref"] = null): Message {
  const message: Message = { id: newId(state, "msg"), managerId, season: state.season, calendarIndex: state.calendarIndex, text, ref };
  state.messages.push(message);
  const mine = state.messages.filter((m) => m.managerId === managerId);
  if (mine.length > MESSAGE_LIMIT) {
    const drop = new Set(mine.slice(0, mine.length - MESSAGE_LIMIT).map((m) => m.id));
    state.messages = state.messages.filter((m) => !drop.has(m.id));
  }
  return message;
}

export function postToClub(state: GameState, clubId: ClubId, text: string, ref: Message["ref"] = null): Message | null {
  const managerId = state.clubs[clubId]?.managerId;
  return managerId ? postMessage(state, managerId, text, ref) : null;
}

export function messagesFor(state: GameState, managerId: ManagerId): Message[] {
  return state.messages.filter((m) => m.managerId === managerId).reverse();
}
