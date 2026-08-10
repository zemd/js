import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isErrorCauseObject,
  isErrorRoot,
  asErrorCause,
  error,
  typeError,
  syntaxError,
} from "./errors.ts";

void describe("error utilities", () => {
  void describe("isErrorCauseObject", () => {
    void it("should return true for plain objects", () => {
      assert.strictEqual(isErrorCauseObject({}), true);
      assert.strictEqual(isErrorCauseObject({ name: "test" }), true);
      assert.strictEqual(isErrorCauseObject({ status: 404 }), true);
    });

    void it("should return false for non-objects", () => {
      assert.strictEqual(isErrorCauseObject(null), false);
      assert.strictEqual(isErrorCauseObject(undefined), false);
      assert.strictEqual(isErrorCauseObject("string"), false);
      assert.strictEqual(isErrorCauseObject(123), false);
      assert.strictEqual(isErrorCauseObject([]), false);
    });
  });

  void describe("isErrorRoot", () => {
    void it("should return true for Error with cause object", () => {
      const err = new Error("test");
      (err as any).cause = { name: "cause" };
      assert.strictEqual(isErrorRoot(err), true);
    });

    void it("should return false for Error without cause", () => {
      assert.strictEqual(isErrorRoot(new Error("test")), false);
    });

    void it("should return false for non-Error values", () => {
      assert.strictEqual(isErrorRoot({}), false);
      assert.strictEqual(isErrorRoot(null), false);
      assert.strictEqual(isErrorRoot("error"), false);
    });
  });

  void describe("asErrorCause", () => {
    void it("should return Error instance as is", () => {
      const err = new Error("test");
      assert.strictEqual(asErrorCause(err), err);
    });

    void it("should return error cause object as is", () => {
      const cause = { name: "test" };
      assert.strictEqual(asErrorCause(cause), cause);
    });

    void it("should create new Error for other values", () => {
      assert.ok(asErrorCause("message") instanceof Error);
      assert.strictEqual((asErrorCause("message") as Error).message, "message");

      assert.strictEqual((asErrorCause(null) as Error).message, "Unknown error");
      assert.strictEqual((asErrorCause(undefined) as Error).message, "Unknown error");
    });
  });

  void describe("error creators", () => {
    void describe("error", () => {
      void it("should create Error with message", () => {
        const err = error("test message");
        assert.ok(err instanceof Error);
        assert.strictEqual(err.message, "test message");
      });

      void it("should create Error with cause", () => {
        const cause = { name: "cause" };
        const err = error("test message", cause);
        assert.ok(err instanceof Error);
        assert.strictEqual(err.cause, cause);
      });
    });

    void describe("typeError", () => {
      void it("should create TypeError with message", () => {
        const err = typeError("test message");
        assert.ok(err instanceof TypeError);
        assert.strictEqual(err.message, "test message");
      });

      void it("should create TypeError with cause", () => {
        const cause = { name: "cause" };
        const err = typeError("test message", cause);
        assert.ok(err instanceof TypeError);
        assert.strictEqual(err.cause, cause);
      });
    });

    void describe("syntaxError", () => {
      void it("should create SyntaxError with message", () => {
        const err = syntaxError("test message");
        assert.ok(err instanceof SyntaxError);
        assert.strictEqual(err.message, "test message");
      });

      void it("should create SyntaxError with cause", () => {
        const cause = { name: "cause", code: "ERR_TEST" };
        const err = syntaxError("test message", cause);
        assert.ok(err instanceof SyntaxError);
        assert.strictEqual(err.cause, cause);
      });
    });

    // it("should capture stack trace with custom from function", () => {
    //   function customFrom() {
    //     return error("test", undefined, customFrom);
    //   }
    //   const err = customFrom();
    //   assert.ok(!err.stack.includes("error@"));
    //   assert.ok(err.stack.includes("customFrom"));
    // });
  });
});
