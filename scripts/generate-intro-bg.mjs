/**
 * Generate the Camargue intro background image using Replicate Flux 1.1 Pro.
 * Saves to public/images/camargue-intro.jpg
 * Cost: ~$0.04 per generation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../public/images');

const API_TOKEN = process.env.REPLICATE_API_TOKEN;
if (!API_TOKEN) { console.error('Set REPLICATE_API_TOKEN env var'); process.exit(1); }
const FLUX_MODEL = 'black-forest-labs/flux-1.1-pro';
const API_URL = `https://api.replicate.com/v1/models/${FLUX_MODEL}/predictions`;
const POLL_URL = 'https://api.replicate.com/v1/predictions';

const PROMPT = `Aerial photograph of the Camargue river delta in southern France at golden hour. Pink salt evaporation ponds in the foreground reflecting warm light. Shallow turquoise lagoons and dark wetland marshes in the middle ground. Winding channels of the Rhone river delta meeting the Mediterranean Sea. White Camargue horses and flamingos visible as tiny dots in the marshes. Rice paddies as geometric green patches. The overall color palette is teal, pink, gold, and deep green. Cinematic wide-angle landscape photography, shot on medium format Hasselblad, natural light, no text, no people in foreground, moody atmospheric haze.`;

async function pollPrediction(predictionId) {
  const maxAttempts = 90;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${POLL_URL}/${predictionId}`, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
    });
    const data = await res.json();

    if (data.status === 'succeeded') {
      console.log(`  Completed in ~${i}s`);
      return data;
    }
    if (data.status === 'failed') {
      throw new Error(data.error || 'Prediction failed');
    }
    if (data.status === 'canceled') {
      throw new Error('Prediction canceled');
    }

    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Timed out');
}

async function main() {
  console.log('Generating Camargue intro background...\n');

  // Start prediction
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        prompt: PROMPT,
        aspect_ratio: '16:9',
        num_inference_steps: 28,
        output_format: 'jpg',
        output_quality: 90,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const prediction = await res.json();
  console.log(`Prediction ID: ${prediction.id}`);

  // Poll for result
  const result = await pollPrediction(prediction.id);
  const imageUrl = typeof result.output === 'string' ? result.output : result.output?.[0];

  if (!imageUrl) throw new Error('No output URL');

  // Download image
  console.log('Downloading...');
  const imgRes = await fetch(imageUrl);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  const outPath = path.join(OUTPUT_DIR, 'camargue-intro.jpg');
  fs.writeFileSync(outPath, buffer);
  console.log(`Saved to ${outPath} (${(buffer.length / 1024).toFixed(0)}KB)`);
}

main().catch(err => {
  console.error(`Failed: ${err.message}`);
  process.exit(1);
});
