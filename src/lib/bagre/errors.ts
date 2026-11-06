/**
 * Bagre error codes. "not_found" is deliberately vague: a group the caller
 * isn't in, a round or nomination of such a group and a malformed id all get
 * it, so an outsider can't tell which ids exist.
 */
export type BagreErrorCode =
  | "not_found"
  | "forbidden"
  | "disabled"
  | "closed"
  | "self"
  | "not_member"
  | "no_account"
  | "match_not_found"
  | "already_nominated"
  | "not_nominator";

export class BagreError extends Error {
  constructor(readonly code: BagreErrorCode) {
    super(code);
    this.name = "BagreError";
  }
}

export const BAGRE_MESSAGES: Record<BagreErrorCode, string> = {
  not_found: "Não encontramos isso no grupo. Atualize a página e tente de novo.",
  forbidden: "Só quem criou o grupo pode mudar isso.",
  disabled: "O Bagre está desligado neste grupo. O dono pode religar em Ajustes do grupo.",
  closed: "Esse período já acabou. O resultado sai em alguns minutos.",
  self: "Em você mesmo não vale. Escolha outra pessoa.",
  not_member: "Essa pessoa não está mais no grupo.",
  no_account: "Essa pessoa ainda não vinculou o Riot ID, então não tem partidas para indicar.",
  match_not_found: "Escolha uma partida que essa pessoa jogou neste período.",
  already_nominated: "Essa pessoa já foi indicada neste período. Vote na indicação que já existe.",
  not_nominator: "Só quem fez a indicação pode retirá-la.",
};
