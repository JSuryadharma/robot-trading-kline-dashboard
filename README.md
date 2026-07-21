# Robot Trading K-Line Dashboard

This project is a self-contained paper-trading robot. It pulls K-line/OHLCV data with a TradingView-first datasource and yfinance/Yahoo fallback, calculates trading indicators, calibrates signal weights against the requested 1 June 2025 to 1 June 2026 dataset, ranks a configurable stock universe by 3-month performance, and serves a websocket dashboard on port `3000`.

## Run

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Default login:

- Username: `admin`
- Password: `admin123`

Change these with `ROBOT_USERNAME` and `ROBOT_PASSWORD` before the first run.

## Datasource

The server tries:

1. TradingView K-line websocket protocol for `TV_SYMBOL` such as `IDX:BBCA`.
2. Yahoo/yfinance-compatible chart API for `YF_SYMBOL` such as `BBCA.JK`.
3. A visibly labeled deterministic sample dataset only when network datasources fail, so the UI and robot still run for development.

The dashboard includes a TradingView K-line monitor for the active symbol and keeps the robot's own indicator/decision data separate.

## Multi-stock Ranking

The UI can select and edit a watchlist plus a ranking universe. Defaults include `BBCA.JK`, `BBRI.JK`, `BMRI.JK`, `ANTM.JK`, and other IDX symbols. The server ranks the universe by 3-month performance and exposes the top 10.

## Research Back Trace

The Summary page includes a collapsible research section for walk-forward backtesting. It can compare 3-month, 6-month, and 1-year daily K-Line windows, with a strict maximum of one year. The automatic duration mode uses a 70% training period and a 30% out-of-sample validation period.

Historical news comes from a cached Google News RSS archive and is scored in a trailing 3-day window for each candle. Research signals execute at the next session open and include a 0.4% round-trip cost. The report shows trade win rate, return, drawdown, parameter-level directional win rates, and current-versus-recommended weights.

Validated tuning can update the live parameter weights, minimum score, and take-profit value. Adjustments are applied only when the validation sample and improvement clear the guard rules; otherwise the recommendation remains research-only.

The Research accordion also supports a dedicated **Day Trade / 15m** mode. It requests up to 60 calendar days of real intraday candles, compares 20/40/maximum-session windows, enters on the next candle, and forces every position to close within the same IDX session. Defaults use a 1.8% target, 1.2% stop, eight-bar maximum hold, and 0.4% round-trip cost. Historical headlines are lagged by one day because archived feeds do not provide reliable intraday publication timestamps.

## Notifications

Application notifications are stored in `data/notifications.json` and pushed to the bell icon over websocket. Telegram messages are sent when these environment variables are present:

```bash
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

## AI review schedule

AI reviews run in `Asia/Jakarta` time at the configurable UI times. Defaults:

- 09:00
- 11:00
- 13:00
- 15:30

News sentiment is analyzed through an OpenAI-compatible LM Studio endpoint by default:

```bash
LMSTUDIO_BASE_URL=http://192.168.1.55:1234/v1
LMSTUDIO_MODEL=qwen/qwen3.5-9b
LMSTUDIO_API_KEY=
LMSTUDIO_TIMEOUT_MS=180000
LMSTUDIO_MAX_TOKENS=1600
LMSTUDIO_REASONING_EFFORT=none
```

By default the scheduled advisor note is local and deterministic. To call OpenAI during scheduled reviews, set:

```bash
AI_ADVISOR_MODE=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

The scheduler can evaluate either the selected watchlist or the current top-10 performers. Auto-trades execute only when the decision clears the configured score and confidence thresholds.

## Gmail Briefs

Gmail alerts use SMTP over `smtp.gmail.com:465`. Configure in the UI or with:

```bash
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=your_app_password
GMAIL_TO=recipient@gmail.com
```

Use a Gmail app password.

## Important

This is a paper-trading simulation and dashboard, not financial advice and not a live broker integration. The filesystem ledger prevents the simulated rupiah balance from going below zero.
