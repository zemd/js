import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { text } from "node:stream/consumers";
import { describe, it } from "node:test";

import PinoPrettyTransport, {
  type PinoPrettyTransportOptions,
} from "@zemd/nestjs-pino-logger/pino-pretty-transport";

const renderLogs = async (
  logs: readonly Record<string, unknown>[],
  options: PinoPrettyTransportOptions = {},
): Promise<string> => {
  const destination = new PassThrough();
  const output = text(destination);
  const transport = PinoPrettyTransport({
    colorize: false,
    singleLine: false,
    sync: true,
    ...options,
    destination,
  });

  transport.end(
    `${logs
      .map((log) => {
        return JSON.stringify(log);
      })
      .join("\n")}\n`,
  );

  return output;
};

const assertNoUnsafeControls = (value: string): void => {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    assert.ok(
      codePoint === 0x0a ||
        (codePoint !== undefined && codePoint > 0x1f && !(codePoint >= 0x7f && codePoint <= 0x9f)),
      `unexpected control character U+${codePoint?.toString(16).padStart(4, "0")}`,
    );
  }
};

void describe("PinoPrettyTransport", () => {
  void it("formats levels, multiline messages, and timestamp deltas", async () => {
    const output = await renderLogs([
      {
        context: "App",
        level: 30,
        msg: "first line\nsecond line",
        time: 1000,
      },
      {
        context: "App",
        level: 40,
        msg: "warning",
        time: 1250,
      },
      {
        context: "App",
        level: 60,
        msg: "fatal",
        time: 1500,
      },
    ]);

    assert.match(
      output,
      /^1970-01-01T00:00:01\.000Z App\.log › first line\n1970-01-01T00:00:01\.000Z App\.log › second line \+0ms$/mu,
    );
    assert.match(output, /^1970-01-01T00:00:01\.250Z App\.warn › warning \+250ms$/mu);
    assert.match(output, /^1970-01-01T00:00:01\.500Z App\.fatal › fatal \+250ms$/mu);
    assert.strictEqual(output.includes("\u001B"), false);
  });

  void it("formats HTTP summaries and errors", async () => {
    const output = await renderLogs([
      {
        context: "Http",
        level: 30,
        msg: "request completed",
        req: { id: "req-1", method: "GET", url: "/health" },
        res: { statusCode: 204 },
        responseTime: 12,
        time: 2000,
      },
      {
        context: "Worker",
        err: {
          message: "boom",
          stack: "TypeError: boom\n    at run (/workspace/job.ts:1:1)",
          type: "TypeError",
        },
        level: 50,
        msg: "job failed",
        time: 3000,
      },
    ]);

    assert.match(
      output,
      /^1970-01-01T00:00:02\.000Z Http\.log › req-1 › GET \/health 204 \(⮂ 12ms\) \+0ms$/mu,
    );
    assert.match(output, /^1970-01-01T00:00:03\.000Z Worker\.error › job failed$/mu);
    assert.match(output, /^1970-01-01T00:00:03\.000Z Worker\.error › TypeError: boom/mu);
    assert.match(output, /at run \(\/workspace\/job\.ts:1:1\) \+1s$/mu);
  });

  void it("preserves logs when timestamps are disabled or malformed", async () => {
    const output = await renderLogs([
      {
        context: "App",
        level: 30,
        msg: "timestamp disabled",
      },
      {
        context: "App",
        level: 30,
        msg: "timestamp malformed",
        time: "not-a-date",
      },
    ]);

    assert.match(output, /^App\.log › timestamp disabled$/mu);
    assert.match(output, /^App\.log › timestamp malformed$/mu);
  });

  void it("uses a safe fallback for unknown levels", async () => {
    const output = await renderLogs([
      {
        context: "App",
        level: 35,
        msg: "custom severity",
      },
    ]);

    assert.match(output, /^App\.35 › custom severity$/mu);
  });

  void it("neutralizes terminal and Unicode log-control characters", async () => {
    const payload = "attacker\u001B]0;owned\u0007\r\u0085\u202E\nforged";
    const errorPayload = "error\u001B]0;owned\u0007\u202E";
    const output = await renderLogs([
      {
        context: payload,
        err: {
          message: errorPayload,
          stack: `Error: ${errorPayload}\n    at run (/workspace/job.ts:1:1)`,
          type: "Error",
        },
        level: 30,
        msg: payload,
        req: {
          id: payload,
          method: "GET",
          url: `/search?q=${payload}`,
        },
        res: { statusCode: 200 },
        responseTime: 1,
        time: 1000,
      },
    ]);

    assertNoUnsafeControls(output);
    assert.match(output, /\\u001b\]0;owned\\u0007\\u000d\\u0085\\u202e\\u000aforged/u);
    assert.strictEqual(output.includes("\u001B]0;owned"), false);
    assert.strictEqual(output.match(/Error: error/gu)?.length, 1);
  });

  void it("emits only transport-owned escape sequences when colorization is enabled", async () => {
    const output = await renderLogs(
      [
        {
          context: "App\u001B]0;owned\u0007",
          level: 30,
          msg: "ready",
          time: 1000,
        },
      ],
      { colorize: true },
    );

    assert.strictEqual(output.includes("\u001B["), true);
    assert.strictEqual(output.includes("\u001B]0;owned"), false);
    assert.match(output, /App\\u001b\]0;owned\\u0007/u);
  });

  void it("keeps single-line output on one line", async () => {
    const output = await renderLogs(
      [
        {
          context: "App",
          err: {
            message: "boom",
            stack: "Error: boom\n    at run (/workspace/job.ts:1:1)",
            type: "Error",
          },
          level: 50,
          msg: "first\nsecond",
        },
      ],
      { singleLine: true },
    );

    assert.doesNotMatch(output.trimEnd(), /\n/u);
    assert.match(output, /first\\u000asecond \| Error: boom/u);
    assert.match(output, /Error: boom\s+at run/u);
  });
});
