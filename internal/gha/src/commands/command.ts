export interface Command {
  /** Argument list shown in the CLI usage text. */
  readonly usage: string;
  readonly run: (argv: readonly string[]) => void | Promise<void>;
}
