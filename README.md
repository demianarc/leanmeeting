# Lean Meeting Facilitator

This demo implements an **Agile Meeting Facilitator** using the OpenAI Agents SDK.

The script `index.js` shows how to combine realtime voice agents with a
supervisor agent and a simple vector store to keep track of action items.

## Features

- **Voice Loop** – `RealtimeSession` streams audio using `gpt-4o-mini-realtime`.
- **Chat-Supervisor** – a fast realtime agent handles "who's next?" and records
  updates while a supervisor agent powered by `gpt-4.1` summarizes the meeting.
- **Memory Driven** – action items are embedded and stored in `memory.json` so
  recurring blockers can be highlighted in the next meeting.
- **Tool Chain** – tools `extractActionItems`, `summarizeDecisions` and
  `scheduleFollowUp` are exposed to the agent.
- **Automations** – `scheduleFollowUp` is a stub where you could integrate
  calendar or Slack APIs for reminders.

## Usage

Install dependencies and run:

```bash
npm install
OPENAI_API_KEY=sk-... node index.js
```

Speak "Start Stand-Up" to begin. Team members can give their updates, and the
agent will call the next speaker. After the stand‑up, the supervisor summarizes
and reminders are scheduled.
