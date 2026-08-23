/**
 * Reachability probe.
 *
 * Iranian venues sit behind CDNs (ArvanCloud, Cloudflare) that filter foreign
 * datacenter ASNs, so "works from my laptop" says nothing about what a Worker
 * can reach. This fetches candidate endpoints from real CF egress and logs the
 * status only — no parsing. Run it, read the matrix, then write parsers for
 * the hosts that actually answered.
 *
 * ponytail: throwaway diagnostic. Delete once the candidate list is decided.
 */

const TIMEOUT_MS = 5000;

/** Browser-ish headers. Beats naive UA rules; does nothing against ASN blocks. */
export const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept: "application/json, text/plain, */*",
  "accept-language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7",
  "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
};

/** Candidates to evaluate. Status-only — a 404 still proves the host answers us. */
const CANDIDATES: Array<{ id: string; url: string }> = [
  // control: definitely reachable, proves the probe itself works
  { id: "_control_coingecko", url: "https://api.coingecko.com/api/v3/ping" },

  // aggregators (often foreign-hosted → best odds)
  { id: "tgju_call1", url: "https://call1.tgju.org/ajax.json" },
  { id: "tgju_api", url: "https://api.tgju.org/v1/market/indicator/summary-table-data/price_dollar_rl" },
  { id: "alanchand", url: "https://alanchand.com/api/arz" },
  { id: "arzdigital", url: "https://arzdigital.com/coins/tether/" },
  { id: "milli", url: "https://api.milliex.com/api/v1/market/stats" },

  // venues not yet in SCRAPERS
  { id: "excoino", url: "https://api.excoino.com/api/v1/exchange/currencies" },
  { id: "phinix", url: "https://api.phinix.ir/api/v1/depth?symbol=USDTIRT" },
  { id: "exnovin", url: "https://api.exnovin.io/api/v1/market" },
  { id: "exbito", url: "https://api.exbito.com/api/v1/markets" },
  { id: "kifpool", url: "https://kifpool.me/api/v1/prices" },
  { id: "arzinja", url: "https://api.arzinja.com/api/v1/market" },
  { id: "bitmoon", url: "https://api.bitmoon.ir/api/v1/market" },
  { id: "mazdax", url: "https://api.mazdax.ir/market" },

  // Path hunting. These hosts answered our scrape with 404/500/HTML, i.e. they
  // are reachable and our stored endpoint is simply wrong. Cheaper to probe a
  // few plausible paths in parallel than to guess one at a time in a parser.
  { id: "tabdeal_a", url: "https://api.tabdeal.org/api/v1/depth/?symbol=USDTIRT" },
  { id: "tabdeal_b", url: "https://api.tabdeal.org/plots/api/v1/depth/?symbol=USDTIRT" },
  { id: "abantether_a", url: "https://abantether.com/api/v1/otc/coin-price/?coin=USDT" },
  { id: "abantether_b", url: "https://api.abantether.com/otc/coin-price?coin=USDT" },
  { id: "ompfinex_a", url: "https://api.ompfinex.com/v1/market" },
  { id: "ompfinex_b", url: "https://api.ompfinex.com/api/v1/market" },
  { id: "bit24_a", url: "https://bit24.cash/api/v1/ticker" },
  { id: "bit24_b", url: "https://api.bit24.cash/v1/ticker" },
  { id: "pooleno_a", url: "https://api.pooleno.ir/v1/price" },
  { id: "pooleno_b", url: "https://pooleno.ir/api/v2/price" },
  { id: "ubitex_a", url: "https://api.ubitex.io/api/v1/market/getticker?symbol=USDTIRT" },
  { id: "ubitex_b", url: "https://ubitex.io/api/v1/ticker" },
  { id: "bitbarg_a", url: "https://api.bitbarg.com/v1/currencies/usdt" },
  { id: "bitbarg_b", url: "https://bitbarg.com/api/v1/currencies/usdt" },
  { id: "arzplus_a", url: "https://arzplus.net/api/v1/currencies/usdt" },
  { id: "arzplus_b", url: "https://api.arzplus.net/api/v1/currencies/usdt" },
  { id: "sarmayex_a", url: "https://market.sarmayex.com/api/v1/market" },
  { id: "hamtapay_a", url: "https://api.hamtapay.com/v1/rates" },
  { id: "bitpin_a", url: "https://api.bitpin.ir/v2/mkt/markets/" },
  { id: "bitpin_b", url: "https://api.bitpin.org/v1/mkt/markets/" },
];

/** Fetch every candidate, return "id status" strings. Never throws. */
export async function probeCandidates(): Promise<string[]> {
  const results = await Promise.all(
    CANDIDATES.map(async ({ id, url }) => {
      const t0 = Date.now();
      try {
        const res = await fetch(url, {
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const len = Number(res.headers.get("content-length") ?? 0);
        await res.body?.cancel();
        return `${id} ${res.status} ${Date.now() - t0}ms ${res.headers.get("server") ?? "-"} ${len || "?"}B`;
      } catch (e) {
        return `${id} ERR ${Date.now() - t0}ms ${(e as Error).message}`;
      }
    }),
  );
  return results;
}
