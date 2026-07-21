# Generation Prompt: Robot Trading K-Line Dashboard

Build a production-quality, filesystem-backed **paper-trading dashboard for Indonesian Stock Exchange (IDX/IHSG) equities**. The application must combine K-Line market data, technical analysis, recent news sentiment, configurable automated paper trading, research/backtracing, notifications, and responsive mobile/desktop interfaces.

The result must be a working application, not a landing page or static mockup. Implement every control, state, API route, fallback, loader, retry action, and paper-trading safeguard described below.

## 1. Product Goal

Create a local robot-trading workspace that helps a user:

- Monitor an IDX stock with an embedded TradingView candlestick/K-Line widget.
- Retrieve and analyze OHLCV candles independently from the visual widget.
- Compare multiple Indonesian stocks and identify current performers.
- Understand a concise technical and news-driven verdict.
- Execute guarded BUY and SELL actions in a filesystem-backed paper portfolio.
- Configure automatic checks and paper trades from the UI.
- Validate the strategy with a one-year, one-day walk-forward backtrace.
- Receive activity updates through the application, Telegram, and Gmail SMTP.

This application is for research and simulation only. It must clearly remain a paper-trading system and must not claim to provide financial advice or connect to a live broker.

## 2. Required Technology

Use this lean stack unless an existing repository requires otherwise:

- Node.js 22 or newer.
- ECMAScript modules.
- Node's built-in HTTP, TLS, crypto, and filesystem APIs.
- A lightweight authenticated WebSocket server for application updates.
- Vanilla HTML, CSS, and browser JavaScript.
- No SQL or external database.
- JSON files under `data/` for users, sessions, settings, portfolio state, notifications, cached news, AI reports, research reports, and market cache.
- `node:test` for automated tests.
- Serve the dashboard on port `3000` by default.

Keep runtime JSON, environment files, credentials, caches, and generated output out of Git. Keep `data/.gitkeep` so the directory exists after cloning.

## 3. Suggested Project Structure

```text
public/
  index.html
  styles.css
  app.js
src/
  server.js
  config.js
  storage.js
  auth.js
  websocket.js
  symbols.js
  marketData.js
  indicators.js
  calibration.js
  decisionEngine.js
  tradingRobot.js
  ranking.js
  news.js
  aiAdvisor.js
  notifications.js
  email.js
  backtrace.js
  dayTradeBacktrace.js
  settings.js
  datasources/
    index.js
    tradingView.js
    yfinance.js
    sample.js
test/
  backtrace.test.js
  dayTradeBacktrace.test.js
  decisionEngine.test.js
data/
  .gitkeep
.env.example
.gitignore
README.md
package.json
```

Use clear module ownership. Do not put datasource, indicator, trading, AI, storage, and UI behavior into one large server file.

## 4. Configuration

Support environment variables equivalent to:

```bash
PORT=3000
ROBOT_TIMEZONE=Asia/Jakarta

TV_SYMBOL=IDX:BBCA
YF_SYMBOL=BBCA.JK
KLINE_INTERVAL=1D
HISTORY_FROM=2025-06-01
HISTORY_TO=2026-06-01

INITIAL_BALANCE=5000000
TRADE_ALLOCATION_PCT=0.75
MAX_POSITION_PCT=0.85
LOT_SIZE=100

ROBOT_USERNAME=admin
ROBOT_PASSWORD=admin123
SESSION_DAYS=7

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

GMAIL_USER=
GMAIL_APP_PASSWORD=
GMAIL_TO=

LMSTUDIO_BASE_URL=http://127.0.0.1:1234/v1
LMSTUDIO_MODEL=qwen/qwen3.5-9b
LMSTUDIO_API_KEY=
LMSTUDIO_TIMEOUT_MS=30000
LMSTUDIO_MAX_TOKENS=1600
LMSTUDIO_REASONING_EFFORT=none

AI_ADVISOR_MODE=local
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Never expose secrets in browser payloads, logs, source control, generated documentation, or error messages. An empty LM Studio token is valid for a local OpenAI-compatible endpoint.

## 5. Authentication and Filesystem State

Implement simple local authentication without a database:

- Initialize the configured default user on first start.
- Hash passwords with PBKDF2 SHA-512, a random salt, and at least 120,000 iterations.
- Store only the salt and hash.
- Use random session tokens stored in a JSON session file.
- Send the session in an `HttpOnly`, `SameSite=Lax` cookie.
- Default session duration: seven days.
- Protect all `/api/*` routes except login.
- Authenticate WebSocket upgrades with the same session cookie.
- Support login, logout, current-user lookup, and password change.
- Require a minimum eight-character new password.

Runtime state must be updated atomically enough to avoid corrupting JSON during normal use. Never allow the simulated cash balance to become negative.

## 6. Symbols and Multi-Stock Support

Normalize stock input in any of these forms:

- `BBCA`
- `BBCA.JK`
- `IDX:BBCA`

Maintain a configurable IDX universe containing at least:

- BBCA.JK
- BBRI.JK
- BMRI.JK
- BBNI.JK
- ANTM.JK
- TLKM.JK
- ASII.JK
- UNTR.JK
- ADRO.JK
- AMMN.JK
- BRPT.JK
- INCO.JK
- MDKA.JK
- PGAS.JK
- GOTO.JK

Provide UI selection for the active stock, selected watchlist, ranking universe, and whether scheduled checks use the selected list or current top 10.

Changing the active stock must load its data once. Do not continuously reload all subscribed content or block the user with unnecessary repeated requests.

## 7. K-Line Datasource Pipeline

The visual TradingView widget and the analysis datasource are separate concerns.

Implement this datasource order:

1. Try the TradingView websocket/K-Line protocol for the TradingView symbol.
2. If TradingView fails, fetch Yahoo Finance/yfinance-compatible chart data for the `.JK` symbol.
3. If both remote sources fail, return a clearly labeled deterministic sample dataset so local development remains usable.

Every response must report:

- The source that succeeded.
- All attempted sources.
- Human-readable warnings for failed sources.
- Sorted and deduplicated candles.
- A latest candle with price, date, and computed indicators.

Load daily history sufficient for indicators and one-year validation. The configured historical reference dataset is 1 June 2025 through 1 June 2026, while the research engine must use the latest valid trailing year available and cap daily sessions at approximately 252 candles.

## 8. TradingView Monitor

Embed the official TradingView advanced chart/widget as the primary visual K-Line monitor:

- Use candlesticks, not a custom replacement chart.
- Set the correct IDX symbol.
- Default to the daily interval.
- Include volume and normal TradingView controls.
- Rebuild the widget when the active symbol changes.
- Keep the widget visible without an accordion.
- Mobile height should be compact and useful, around 300px.
- Desktop height should be approximately 430px to 560px.
- On large desktop screens, position Price History Summary beside the chart.
- Show the actual datasource status separately because the widget may render even when the TradingView data websocket fallback is used by the analysis engine.

## 9. Technical Indicators

For every candle, calculate and expose:

- Open, high, low, close, and volume.
- Current price and close price.
- Price change percentage.
- SMA 5, 20, 50, 100, and 200.
- Volume SMA 20.
- EMA 12 and EMA 26.
- MACD, signal, and histogram.
- RSI 14.
- Stochastic %K and %D using a 14-period window and three-period smoothing.
- ATR 14 and ATR as a percentage of close.
- Bollinger middle, upper, and lower bands using 20 periods and two deviations.

Detect technical events including:

- SMA 5/20 golden and death crosses.
- Price reclaim or loss of SMA 20.
- RSI rebound from 30 and fade from 70.
- Stochastic bullish and bearish crosses in meaningful zones.
- MACD bullish and bearish crosses.
- Lower Bollinger reversal and upper-band rejection.
- Bullish and bearish break of structure.
- Bullish and bearish trend change around SMA 20/SMA 50.

Build market-structure data containing recent swing high/low, support, resistance, trend, break of structure, and trend change. Produce buy target, sell target, and technical stop-loss prices using structure and ATR.

## 10. Signal Significance

Calibrate detected signals against historical forward returns and show:

- Signal direction.
- Number of occurrences.
- Win rate.
- Average signed return.
- Significance level.
- Weight multiplier.

The user-facing Signal Significance chart must focus on the latest one-month range and render detailed candles. Add clear markers at every break of structure and trend-change event. Include a compact significance table below the chart.

## 11. Price History and Rankings

Below or beside TradingView, show a concise swipeable Price History Summary containing:

- 1D, 5D, 1M, and 3M performance.
- Three-month high and low.
- Drawdown.
- 20-day volatility.
- 20-day average volume.
- Number of loaded candles.

Create two market comparison features:

### Top 10 Three-Month Performers

- Rank the configurable universe by three-month price performance.
- Show latest close, high, low, 20-day average volume, buy target, sell target, and technical stop.

### Weekly Trading Plan

- Rank current IHSG candidates using the latest week.
- Show close, absolute and percentage differences for 1D and 1W, five-session high/low range, five-day average volume, and a concise plan label.
- Use labels such as Momentum candidate, Pullback watch, Breakout watch, Weak this week, or Neutral watch.

## 12. News Collection and LM Studio Analysis

The LM Studio model does **not** crawl or provide articles. The application must fetch headlines and URLs first, then send that collected context to LM Studio.

For current news:

- Fetch Yahoo Finance RSS headlines.
- Perform a Bing News web-search crawl/fallback.
- Deduplicate articles by normalized title and URL.
- Prefer articles dated from three days before today through today in `Asia/Jakarta`.
- Preserve headline, source name, publication date, summary/snippet, and source URL.
- Ignore older items for the live three-day verdict, but explain when older fallback items exist.

For historical research:

- Build a cached Google News RSS archive in date segments.
- Never expose a future headline to an earlier candle.
- Use a trailing three-day news window for each daily decision.
- Deduplicate and cap cached historical records to a reasonable size.

Call LM Studio through its OpenAI-compatible `POST /chat/completions` API using the configured base URL and `qwen/qwen3.5-9b` model. Ask for strict JSON containing:

- `verdict`: positive, negative, or neutral.
- A bounded sentiment score.
- Confidence percentage.
- A concise three-day summary of what happened.
- Dated daily summaries when available.
- Per-article summaries linked to the original source URL.
- Risks and catalysts.

The AI News Verdict must evaluate **news only**, not technical indicators. The final trading engine may later combine the news contribution with independently calculated technical parameters.

When LM Studio is unreachable, times out, returns malformed JSON, or has no usable model:

- Mark LM Studio as attempted.
- Show the actual error without exposing secrets.
- Complete the process with a deterministic local sentiment fallback.
- Update status from loading to completed/fallback/failed when fetching finishes.
- Show source count and analysis engine used.
- Provide a Retry news verdict button.
- Never leave the UI permanently stuck on a stale `fetch failed` status.

## 13. Decision Engine

Keep technical and news calculations inspectable and separate, then create a final score.

The weighted parameters are:

- Previous completed candle performance.
- Trend structure.
- Momentum.
- Volatility risk.
- Volume confirmation.
- Historical signal calibration.
- Current reversal/swing triggers.
- AI News Verdict.

Default each parameter weight to `1.0` and normalize user/research-adjusted weights to a safe range such as `0.5` through `1.5`.

Previous-candle assessment should include:

- Candle body strength.
- Close location inside the range.
- Daily price change.
- Opening gap from the prior close.
- Volume relative to the 20-day average.

News contribution rules:

- Do not let news affect the score when there are no source headlines.
- Bound the news contribution so it cannot overwhelm the technical assessment.
- Reduce influence for local fallback analysis compared with a successful LM Studio analysis.
- Apply the configurable news weight.

Return a decision object containing:

- BUY, SELL, or HOLD action.
- Human-readable verdict.
- Technical score.
- Raw, base, and applied news score.
- Final score and score breakdown.
- Confidence label and percentage.
- Buy/sell thresholds.
- Every parameter's raw score, applied weight, weighted score, bias, and explanation.
- Price targets, structure data, triggers, and reasons.

Default execution gate:

- Auto trading enabled.
- Minimum final score: 58.
- Minimum confidence: medium.
- Take profit: 7%.
- Stop loss: 4.5%.
- Trade on refresh: disabled.

BUY only when the decision and configurable execution gate pass and there is no existing position. SELL when a bearish score passes the gate, or immediately for configured take-profit/stop-loss protection. Protective SELL actions must not be blocked by the normal score threshold.

## 14. Paper-Trading Robot

Start with Rp 5,000,000 unless configured otherwise. Persist:

- Initial balance.
- Available balance.
- Realized profit.
- Open positions.
- Up to 250 recent transactions.

Trading constraints:

- Allocate at most 75% of available cash per BUY.
- Cap a position at 85% of initial capital.
- Respect IDX lot size, default 100 shares.
- Never spend more than available cash.
- Never allow balance below zero.
- Do not open a second position in the same stock.
- Deduct BUY cost from cash.
- On SELL, return gross proceeds to cash and record realized profit.
- Mark positions to market for equity and unrealized P/L.
- Support a guarded manual auto-trade check and a separate force/trade-verdict action where appropriate.
- Log the reason and timestamp for every transaction.

The Position UI must include an interactive stop-loss slider from `0.5%` to `15%` in `0.5%` steps, alongside minimum score and take-profit controls. Update labels and the risk/reward preview live. Presets should provide conservative, balanced, and active values. Persist the selected stop and use it in live, manual, scheduled, and research execution.

## 15. Scheduled Reviews and Auto Trading

Use `Asia/Jakarta` time and configurable daily checks. Defaults:

- 09:00
- 11:00
- 13:00
- 15:30

Requirements:

- Poll the clock safely without executing the same scheduled label twice in one day.
- Allow the schedule to be enabled/disabled in the UI.
- Use either selected stocks or the current top 10.
- Evaluate candidates, news, and technical data.
- Sort AI reports by latest update descending.
- Send application notifications for results and orders.
- Execute an automatic paper trade only when enabled and the verdict clears score and confidence gates.
- Allow `Trade on refresh` as an explicit opt-in; do not trade merely because a page loaded.
- Provide a manual Run check button.

Avoid background market refresh loops that repeatedly block the interface. Load subscribed content on initial page load, active-stock change, manual refresh, scheduled review, retry, research request, or post-trade refresh.

## 16. One-Year Auto-Trade Backtrace

The primary Research section must be simple and fixed to:

- Range: one year.
- Timeframe: one day.
- Maximum valid data: approximately 252 daily candles.
- Walk-forward split: 70% training and 30% out-of-sample validation.

Do not expose confusing range or timeframe selectors in the main Research UI.

Backtrace behavior:

- Use only completed candles.
- Assess a signal after daily close.
- Enter at the next session open to avoid look-ahead bias.
- Use only news available on or before the decision date.
- Apply a 0.4% round-trip simulated cost.
- Exit on configured stop loss, take profit with weakening score, bearish score, maximum holding period, or validation-window end.
- Report why a strategy produced zero trades, including highest executable score and effective gate.

Optimize and compare:

- Minimum score.
- Take-profit percentage.
- Stop-loss percentage.
- Maximum holding days.
- Weights for previous candle, trend, momentum, volatility, volume, calibration, reversal triggers, and news.

Test multiple weight profiles, nearby thresholds, nearby profit/stop targets, and holding periods. Select candidates using training and validation results with penalties for tiny samples.

Report:

- Training and validation dates/candle counts.
- Baseline, optimized, and final strategy.
- Trade count, wins, losses, win rate, total return, average return, profit factor, maximum drawdown, and average hold.
- Entry, exit, reason, final score, technical score, news score, and previous-candle assessment for every validation trade.
- Parameter-level occurrences, directional win rate, and average signed return.
- Current, best-tested, and final values for all weights and risk settings.
- Whether an adjustment was applied and why.

Only apply optimized values when out-of-sample evidence clears guarded rules. Require a meaningful sample, better win rate and return, and acceptable drawdown. If evidence is weak, keep live parameters and explain the rejection.

Add an interactive Technical Weight Adjustment editor with sliders. Let the user compare Active final versus Best tested values, make custom changes, and save them as the live auto-trade weights.

Keep an internal/testable 15-minute day-trade backtrace module if desired, with no overnight positions and no look-ahead news, but do not clutter the main one-year daily Research interface with an extra mode selector.

## 17. Notifications and Email

### In-App Notifications

- Persist up to roughly 160 items.
- Sort newest first.
- Push new items over WebSocket.
- Show an unread bell count.
- Support mark-all or selected items as read.
- Include trend updates, AI checks, research results, and paper orders.

### Telegram

- Send messages through Telegram Bot API when token and chat ID are configured.
- Include title, message, level, and timestamp.
- Fail gracefully without breaking local notification persistence.

### Gmail SMTP

- Send through `smtp.gmail.com:465` using TLS and Gmail app-password authentication.
- Configure enable state, recipient, sender, and app password from the Notifications page.
- Never send the stored password back to the browser.
- Show only whether a password is configured.
- Default sender/recipient may be prefilled from environment configuration.
- Send concise scheduled briefs containing candidate, action, final/technical/news score, confidence, 3M performance, news verdict, and leading headline.

## 18. HTTP and WebSocket API

Provide authenticated JSON routes equivalent to:

- `POST /api/login`
- `GET /api/me`
- `POST /api/logout`
- `POST /api/password`
- `GET /api/settings`
- `POST /api/settings`
- `GET /api/config`
- `GET /api/snapshot`
- `POST /api/refresh`
- `POST /api/news-retry`
- `POST /api/trade`
- `POST /api/research/backtrace`
- `GET /api/notifications`
- `POST /api/notifications/read`
- `POST /api/critical-review`

Use the WebSocket channel for:

- Updated snapshots.
- Notifications.
- News-fetch progress.
- Research progress.
- Connection-state indication.

Return useful HTTP status codes and concise JSON errors. Do not leak stack traces or credentials to the client.

## 19. UI Information Architecture

Use four focused functional pages controlled by the same application shell:

### Summary

- Active stock and concise portfolio metrics.
- TradingView K-Line monitor.
- Price History Summary.
- One-week IHSG Trading Plan.
- Collapsible one-year Auto-Trade Backtrace.

### AI Decision

- Timeframe Bias selector for intraday, swing, and position summaries.
- Current AI news verdict and three-day date range.
- Clear fetch/LM Studio status.
- Article summaries with source URL.
- Retry news and trigger-trade actions.
- Prior AI reports sorted newest first.
- Essential Auto Trade Parameters.
- Indicator output.
- One-month Signal Significance chart and table.

### Position

- Cash, equity, open quantity, average entry, P/L, verdict, price targets, technical stop, configured auto stop, structure, and risk/reward.
- Manual Trigger auto trade and Trade verdict buttons.
- Interactive auto-trade rules, presets, score/TP/SL sliders, confidence, schedule, stock universe, and alert settings.
- Paper-trading ledger.

### Notifications

- Application activity ordered newest first.
- Gmail SMTP configuration.
- Top 10 three-month performers.

Scrollable lists and large secondary sections should be collapsible. Do not collapse the TradingView monitor or Price History Summary. Add loaders to every asynchronously subscribed content area and disable/busy-state buttons during their request.

## 20. Responsive Design

Create two intentional layouts rather than stretching one interface.

### Mobile Layout: Below 960px

- Preserve a phone-first experience with a black header, white surfaces, restrained lime accent, and compact typography.
- Use one focused content column.
- Use a fixed floating bottom navigation bar with Summary, AI, Position, and Notifications.
- Keep touch targets accessible and avoid overlapping the bottom menu.
- Keep TradingView compact and horizontally contained.
- Use swipeable Price History Summary slides.
- Hide desktop-only navigation branding and labels.
- Avoid page-level horizontal overflow; tables may scroll inside their own wrappers.

### Desktop Layout: 960px and Wider

- Use a persistent black left navigation rail with full labels and paper-mode status.
- Use a clear top header with connection status, active stock selector, refresh, notifications, and logout.
- Use a 12-column content workspace.
- Show five summary metrics in one row.
- Give each functional page a tailored panel arrangement.
- Position overview and rules side by side.
- Place activity and Gmail settings side by side.
- Pair compact AI bias panels with the wider news/decision areas.
- At 1280px and wider, place TradingView and Price History Summary side by side.
- Prevent page-level horizontal overflow at 1024px, 1280px, and 1440px.

Use familiar icons, tooltips for icon-only actions, controls appropriate to their values, cards no rounder than 8px on desktop, and clear positive/negative colors. Do not use decorative gradients or oversized marketing sections. Preserve readable text at 360px, 390px, 1024px, and 1440px.

## 21. Error Handling and Loading States

Every remote or long-running operation needs a visible lifecycle:

- Idle.
- Loading with spinner and concise current stage.
- Completed.
- Completed with fallback.
- Failed with retry when useful.

Cover at least:

- Initial market snapshot.
- Active-symbol change.
- TradingView initialization.
- News crawl.
- LM Studio analysis.
- Manual refresh.
- Paper-trade request.
- Settings save.
- Notification update.
- One-year backtrace.

Use timeouts, abort controllers, bounded caches, and local fallbacks. A failed third-party source must not make the entire dashboard unusable.

## 22. Tests and Acceptance Criteria

Add automated tests proving:

- Historical news never leaks future headlines into an earlier candle.
- Intraday research excludes same-session news when timestamps are unreliable.
- Backtrace history is capped at one year and uses a walk-forward validation split.
- Zero-trade validation is reported as inconclusive with entry diagnostics.
- Intraday research never holds overnight.
- Positive and negative LM Studio news move the final score in the correct direction.
- News with no source headline has zero trading influence.
- Local fallback news has lower influence than successful LM Studio news.
- Configurable news weights change only the applied contribution.
- Previous completed candle performance affects the technical score.
- A configured stop loss triggers a protective SELL.

Provide scripts:

```json
{
  "start": "node src/server.js",
  "dev": "node --watch src/server.js",
  "check": "node --check src/server.js && node --check src/dayTradeBacktrace.js && node --check public/app.js",
  "test": "node --test"
}
```

Before considering the application complete:

1. Run syntax checks and the full automated test suite.
2. Verify no credentials or runtime JSON files are tracked.
3. Open the dashboard on port 3000.
4. Test authenticated loading and navigation.
5. Check Summary, AI Decision, Position, and Notifications at 390px, 1024px, and 1440px.
6. Confirm no page-level horizontal overflow.
7. Confirm TradingView is visible and nonblank.
8. Confirm slider labels and rule previews update immediately.
9. Confirm news and research statuses finish instead of remaining stuck in loading.
10. Confirm BUY cannot create a negative balance and SELL returns proceeds correctly.

Deliver the complete runnable project, `.env.example`, README setup instructions, and this paper-trading disclaimer. Do not include real tokens, passwords, private user data, or generated runtime state.
