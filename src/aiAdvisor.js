import { config } from './config.js';

export function buildAdvisorPrompt(snapshot, decision, portfolio, checkLabel) {
  const latest = snapshot.latest || {};
  const position = portfolio.positions?.[snapshot.symbol];
  const news = decision.newsAnalysis;
  return [
    `You are reviewing a paper-trading robot at the ${checkLabel} critical market hour.`,
    `Symbol: ${snapshot.symbol} (${snapshot.yfSymbol}), interval: ${snapshot.interval}, source: ${snapshot.source}.`,
    `Latest candle date: ${latest.date}, close/current price: ${latest.close}.`,
    `MA values: MA5=${latest.sma5}, MA20=${latest.sma20}, MA50=${latest.sma50}, MA100=${latest.sma100}, MA200=${latest.sma200}.`,
    `Momentum: RSI14=${latest.rsi14}, StochK=${latest.stochK}, StochD=${latest.stochD}, MACD histogram=${latest.macdHistogram}.`,
    `Risk: ATR%=${latest.atrPct}, Bollinger lower=${latest.bbLower}, upper=${latest.bbUpper}.`,
    `Portfolio: balance=${portfolio.balance}, position=${position ? `${position.quantity} @ ${position.averagePrice}` : 'none'}.`,
    `Robot verdict: ${decision.verdict}, action=${decision.action}, score=${decision.score}, confidence=${decision.confidence}.`,
    `Combined confidence percentage: ${decision.confidencePercentage ?? 'n/a'}%.`,
    news ? `Today's AI news verdict: ${news.verdict}, news score=${news.score}, news confidence=${news.confidencePercentage}%, summary=${news.summary}.` : 'Today news verdict: unavailable.',
    `Parameter summary: ${decision.parameters.map((item) => `${item.name}=${item.score} (${item.bias})`).join('; ')}.`,
    'Return a short operator note with risk, reason, and whether the robot action should remain unchanged.'
  ].join('\n');
}

export async function getAdvisorReport(snapshot, decision, portfolio, checkLabel) {
  const prompt = buildAdvisorPrompt(snapshot, decision, portfolio, checkLabel);
  if (config.ai.mode === 'openai' && config.ai.openaiApiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.ai.openaiApiKey}`
        },
        body: JSON.stringify({
          model: config.ai.model,
          input: prompt
        })
      });
      if (!response.ok) throw new Error(`OpenAI API HTTP ${response.status}`);
      const body = await response.json();
      const text = body.output_text || body.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join('\n');
      return {
        mode: 'openai',
        prompt,
        text: text || localAdvisorText(decision, snapshot, portfolio),
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        mode: 'local-fallback',
        prompt,
        text: `${localAdvisorText(decision, snapshot, portfolio)} OpenAI advisor failed: ${error.message}`,
        createdAt: new Date().toISOString()
      };
    }
  }

  return {
    mode: 'local',
    prompt,
    text: localAdvisorText(decision, snapshot, portfolio),
    createdAt: new Date().toISOString()
  };
}

function localAdvisorText(decision, snapshot, portfolio) {
  const latest = snapshot.latest || {};
  const position = portfolio.positions?.[snapshot.symbol];
  const warning = snapshot.source === 'sample'
    ? 'Datasource is sample data, so do not treat this as a market instruction.'
    : 'Datasource is live/external K-line output.';
  const exposure = position ? `Open exposure is ${position.quantity} units with average ${position.averagePrice}.` : 'No open position.';
  const mainReason = decision.reasons?.[0] || 'No dominant reason available.';
  return `${decision.action} remains the robot action with ${decision.confidence} confidence. ${mainReason}. ${exposure} ${warning}`;
}
