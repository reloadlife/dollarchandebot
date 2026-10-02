import { expect, test } from "bun:test";
import { isSiteOrigin, readApiKey, sha256Hex } from "./keys";

test("readApiKey accepts bearer and x-api-key", () => {
  expect(readApiKey(new Request("https://api.dollarchande.live/api/v1", {
    headers: { authorization: "Bearer dc_abc" },
  }))).toBe("dc_abc");
  expect(readApiKey(new Request("https://api.dollarchande.live/api/v1", {
    headers: { "x-api-key": "dc_xyz" },
  }))).toBe("dc_xyz");
  expect(readApiKey(new Request("https://api.dollarchande.live/api/v1"))).toBeNull();
});

test("site origin is only dollarchande.live", () => {
  expect(isSiteOrigin("https://dollarchande.live")).toBe(true);
  expect(isSiteOrigin("https://dollarchande-web.pages.dev")).toBe(false);
  expect(isSiteOrigin("https://preview.dollarchande-web.pages.dev")).toBe(false);
  expect(isSiteOrigin("https://www.dollarchande.live")).toBe(false);
  expect(isSiteOrigin("https://evil.example")).toBe(false);
  expect(isSiteOrigin(null)).toBe(false);
});

test("sha256 is stable", async () => {
  expect(await sha256Hex("dc_test")).toBe(await sha256Hex("dc_test"));
  expect(await sha256Hex("dc_test")).not.toBe(await sha256Hex("dc_other"));
});
