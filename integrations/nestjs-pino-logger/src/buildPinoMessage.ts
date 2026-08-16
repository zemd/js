import { PinoMessageSymbol } from "./logger.constants";

export interface PinoMessageInput {
  readonly message: string;
  readonly mergingObject?: Readonly<Record<string, unknown>>;
  readonly interpolationValues?: readonly unknown[];
}

export type PinoMessage = PinoMessageInput & {
  readonly [PinoMessageSymbol]: true;
};

export const buildPinoMessage = (message: PinoMessageInput): PinoMessage => {
  const result: PinoMessage = {
    ...message,
    [PinoMessageSymbol]: true,
  };
  return Object.freeze(result);
};
