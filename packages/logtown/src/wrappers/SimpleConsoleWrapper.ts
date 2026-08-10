import type { LoggerWrapper } from "../index.ts";

export const SimpleConsoleWrapper: LoggerWrapper = {
  debug: (payload) => {
    console.debug(payload.message);
  },
  error: (payload) => {
    console.error(payload.message);
  },
  info: (payload) => {
    console.info(payload.message);
  },
  warn: (payload) => {
    console.warn(payload.message);
  },
  verbose: (payload) => {
    console.log(payload.message);
  },
};
