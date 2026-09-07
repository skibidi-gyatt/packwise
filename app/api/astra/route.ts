import { env } from 'cloudflare:workers';
import { z } from 'zod';
import {
  perceive,
  interpret,
  interpretCargo,
  captureCargoPhoto,
  captureTransportPhoto,
} from '@/lib/astra/client';
const runtime = () => {
  const e = env as Record<string, string | undefined>;
  return {
    key: e.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '',
    model: e.ASTRA_MODEL || process.env.ASTRA_MODEL || 'gpt-6-astra',
  };
};
const image = z.object({
  role: z.enum(['container', 'items', 'side']),
  data: z
    .string()
    .max(4500000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
});
const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('transport-capture'),
    images: z.array(image).min(1).max(2),
    reference: z.string().max(1500),
    estimateMode: z.enum(['reference', 'demo']).default('reference'),
    transportKind: z.enum(['truck', 'container', 'other']).default('other'),
  }),
  z.object({
    action: z.literal('capture'),
    images: z.array(image).min(1).max(2),
    reference: z.string().max(1500),
    mode: z.enum(['single', 'batch']),
    items: z
      .array(z.object({ id: z.string().max(40), name: z.string().max(80) }))
      .max(30),
  }),
  z.object({
    action: z.literal('perceive'),
    images: z.array(image).min(1).max(2),
    reference: z.string().max(1500),
  }),
  z.object({
    action: z.enum(['interpret', 'cargo-intent']),
    text: z.string().min(1).max(1500),
    items: z
      .array(
        z.object({
          id: z.string().min(1).max(40),
          name: z.string().min(1).max(80),
          deliveryStop: z.number().int().min(1).max(20).optional(),
          destination: z.string().max(80).optional(),
          stackable: z.boolean().optional(),
        }),
      )
      .max(30),
  }),
]);
export function GET() {
  const c = runtime();
  return Response.json(
    { available: Boolean(c.key), model: c.model },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function POST(request: Request) {
  if (
    request.headers.get('origin') &&
    request.headers.get('origin') !== new URL(request.url).origin
  )
    return Response.json(
      { error: 'Cross-origin requests are not allowed.' },
      { status: 403 },
    );
  if (!request.headers.get('content-type')?.includes('application/json'))
    return Response.json({ error: 'Use JSON input.' }, { status: 415 });
  const config = runtime();
  if (!config.key)
    return Response.json(
      {
        error:
          'Runtime Astra is not connected. Configure OPENAI_API_KEY on the server, or use the sample manifest and cargo editor.',
      },
      { status: 503 },
    );
  try {
    // Bound the actual streamed bytes, not only the untrusted content-length header.
    const reader = request.body?.getReader();
    if (!reader) throw new Error('A request body is required.');
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 9500000) {
        await reader.cancel();
        return Response.json(
          { error: 'Photos are too large.' },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const data = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.length;
    }
    const parsed = bodySchema.safeParse(
      JSON.parse(new TextDecoder().decode(data)),
    );
    if (!parsed.success)
      return Response.json(
        {
          error:
            'Invalid request. Use one or two JPEG, PNG or WebP photos, and at most 30 cargo units.',
        },
        { status: 400 },
      );
    const b = parsed.data;
    const result =
      b.action === 'capture'
        ? await captureCargoPhoto(
            config,
            b.images,
            b.reference,
            b.mode,
            b.items,
          )
        : b.action === 'transport-capture'
          ? await captureTransportPhoto(
              config,
              b.images,
              b.reference,
              undefined,
              b.estimateMode,
              b.transportKind,
            )
          : b.action === 'perceive'
            ? await perceive(config, b.images, b.reference)
            : b.action === 'cargo-intent'
              ? await interpretCargo(config, b.text, b.items)
              : await interpret(config, b.text, b.items);
    return Response.json(
      { result, provider: 'astra', model: config.model },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Astra could not complete the request.',
      },
      { status: 502 },
    );
  }
}
