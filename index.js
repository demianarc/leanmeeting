import { RealtimeAgent, RealtimeSession, tool } from '@openai/agents/realtime';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

const openai = new OpenAI();
const memoryFile = path.resolve('memory.json');

// simple vector store using embeddings
class VectorStore {
  constructor(file = memoryFile) {
    this.file = file;
    this.data = [];
  }
  async load() {
    try {
      const text = await fs.readFile(this.file, 'utf8');
      this.data = JSON.parse(text);
    } catch {
      this.data = [];
    }
  }
  async save() {
    await fs.writeFile(this.file, JSON.stringify(this.data, null, 2));
  }
  async add(text) {
    const e = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    this.data.push({ embedding: e.data[0].embedding, text });
    await this.save();
  }
  async query(text, k = 3) {
    if (!this.data.length) return [];
    const e = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    const queryVec = e.data[0].embedding;
    const scored = this.data.map(item => {
      const score = item.embedding.reduce((acc, v, i) => acc + v * queryVec[i], 0);
      return { score, text: item.text };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, k).map(s => s.text);
  }
}

const store = new VectorStore();
await store.load();

// tool definitions
const extractActionItems = tool({
  name: 'extractActionItems',
  description: 'Extract action items from meeting text',
  parameters: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
  },
  execute: async ({ text }) => {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Extract action items as bullet list.' },
        { role: 'user', content: text },
      ],
    });
    const items = completion.choices[0].message.content.trim();
    await store.add(items);
    return items;
  },
});

const summarizeDecisions = tool({
  name: 'summarizeDecisions',
  description: 'Summarize decisions from meeting text',
  parameters: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
  },
  execute: async ({ text }) => {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Summarize decisions briefly.' },
        { role: 'user', content: text },
      ],
    });
    return completion.choices[0].message.content.trim();
  },
});

const scheduleFollowUp = tool({
  name: 'scheduleFollowUp',
  description: 'Schedule follow up reminders for action items',
  parameters: {
    type: 'object',
    properties: { items: { type: 'string' } },
    required: ['items'],
  },
  execute: async ({ items }) => {
    console.log('Scheduling reminders for:\n', items);
    return 'reminders scheduled';
  },
});

// realtime chat agent
const chatAgent = new RealtimeAgent({
  name: 'standup-bot',
  instructions:
    'Facilitate the stand-up. Call each speaker in order and record action items.',
  tools: [extractActionItems, summarizeDecisions, scheduleFollowUp],
});

// supervisor agent for summarization
const supervisorAgent = new RealtimeAgent({
  name: 'supervisor',
  instructions: 'Summarize the meeting when asked.',
  model: 'gpt-4.1',
  tools: [extractActionItems, summarizeDecisions, scheduleFollowUp],
});

// demo flow
await (async () => {
  const session = new RealtimeSession(chatAgent, {
    transport: 'websocket',
  });

  session.on('response.done', async (msg) => {
    console.log('assistant:', msg.text);
  });

  await session.connect({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log('Say "Start Stand-Up" to begin.');
})();
