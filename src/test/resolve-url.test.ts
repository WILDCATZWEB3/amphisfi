import { describe, expect, test } from "bun:test";

import { describeRpcConfig, isLikelyApiKey, resolveRobinhoodRpcUrl } from "../lib/rpc/resolve-url";

describe("resolveRobinhoodRpcUrl", () => {
  test("passes through https urls", () => {
    expect(resolveRobinhoodRpcUrl("https://example.com/v2/abc")).toBe("https://example.com/v2/abc");
  });
  test("builds alchemy url from bare key without exposing it in describe", () => {
    const key = "AbCdEfGhIjKlMnOpQrStUvWxYz12";
    const url = resolveRobinhoodRpcUrl(key);
    expect(url).toBe(`https://robinhood-mainnet.g.alchemy.com/v2/${key}`);
    const d = describeRpcConfig(key);
    expect(d.mode).toBe("alchemy_key");
    expect(JSON.stringify(d)).not.toContain(key);
  });
  test("rejects empty / junk", () => {
    expect(resolveRobinhoodRpcUrl("")).toBeNull();
    expect(resolveRobinhoodRpcUrl("not a key")).toBeNull();
    expect(isLikelyApiKey("short")).toBe(false);
  });
});
