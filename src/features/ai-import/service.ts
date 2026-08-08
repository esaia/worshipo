import 'server-only';

import OpenAI from 'openai';

import { serverEnv } from '@/lib/env';
import { EXTRACT_SONG_PROMPT } from './prompt';
import { extractedSongJsonSchema, extractedSongSchema, type ExtractedSong } from './schema';

/**
 * Raised when the feature is not configured, so the route can answer 501 rather
 * than 502 — "nobody set this up" and "the model failed" are different problems
 * and only one of them is worth retrying.
 */
export class ImportNotConfiguredError extends Error {
  constructor() {
    super('OPENAI_API_KEY is not set');
    this.name = 'ImportNotConfiguredError';
  }
}

/**
 * Built per call, not at module scope.
 *
 * `OPENAI_API_KEY` is optional in the env schema — the rest of the app runs fine
 * without it. A module-scope client would throw at import time and take down
 * every route that transitively imports this one.
 */
function client(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

/** gpt-5* and the o-series accept only their default temperature. */
function supportsTemperature(model: string): boolean {
  return !/^(gpt-5|o\d)/.test(model);
}

export async function extractSongFromImage(file: File): Promise<ExtractedSong> {
  const env = serverEnv();
  if (!env.OPENAI_API_KEY) throw new ImportNotConfiguredError();

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const dataUrl = `data:${file.type};base64,${base64}`;

  const completion = await client(env.OPENAI_API_KEY).chat.completions.create({
    model: env.OPENAI_VISION_MODEL,
    // Transcription, not composition — any creativity here is a defect. The
    // reasoning models reject any temperature but their default, so the setting
    // is omitted rather than sent-and-refused (a 400, surfaced as a 502).
    ...(supportsTemperature(env.OPENAI_VISION_MODEL) ? { temperature: 0 } : {}),
    max_completion_tokens: 4096,
    messages: [
      { role: 'system', content: EXTRACT_SONG_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract this song sheet.' },
          // `detail: 'high'` is required: small Georgian glyphs and the column a
          // chord sits in are both lost at low detail.
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'extracted_song', strict: true, schema: extractedSongJsonSchema },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from vision model');

  return extractedSongSchema.parse(JSON.parse(raw));
}
