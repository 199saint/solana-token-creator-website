// api/trending.js
export default async function handler(req, res) {
  try {
    const MORALIS_KEY = process.env.MORALIS_API_KEY;
    if (!MORALIS_KEY) {
      return res.status(500).json({ error: "Falta configurar MORALIS_API_KEY en Vercel" });
    }

    // Llamada a la API de Moralis (tokens nuevos de Pump.fun)
    const url = "https://solana-gateway.moralis.io/token/mainnet/exchange/pumpfun/new?limit=200";
    const moralisResp = await fetch(url, {
      headers: { "accept": "application/json", "X-API-Key": MORALIS_KEY }
    });
    const moralisJson = await moralisResp.json();

    // Obtener tipo de cambio USD→EUR
    const rateResp = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=EUR");
    const rateJson = await rateResp.json();
    const usdToEur = rateJson?.rates?.EUR || 0.95;

    const NOW_MS = Date.now();
    const SUPPLY = 1_000_000_000; // supply fijo en Pump.fun
    const items = moralisJson.result || moralisJson.tokens || [];
    const out = [];

    for (const t of items) {
      const created = t.createdAt || t.created_at || t.blockTime;
      if (!created) continue;

      const createdMs = typeof created === "number" ? created * 1000 : Date.parse(created);
      const ageSeconds = (NOW_MS - createdMs) / 1000;

      // ✅ aquí filtramos tokens con edad menor a 1 semana (604800s)
      if (ageSeconds > 604800) continue;

      const priceUsd = Number(t.price?.usd || t.priceUSD || 0);
      if (!priceUsd) continue;

      const mcUsd = priceUsd * SUPPLY;
      const mcEur = mcUsd * usdToEur;

      if (mcEur > 10000 && mcEur < 50000) {
        out.push({
          name: t.name,
          symbol: t.symbol,
          mint: t.mintAddress,
          price_usd: priceUsd,
          marketcap_eur: Math.round(mcEur),
          age_minutes: Math.floor(ageSeconds / 60)
        });
      }
    }

    res.status(200).json({ items: out, usdToEur });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno en trending.js" });
  }
}
