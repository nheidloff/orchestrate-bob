import { pipeline, env } from '@xenova/transformers';

// Set cache directory from HF_HOME environment variable if present
env.cacheDir = process.env.HF_HOME || './.cache';

async function main() {
  console.log(`Pre-downloading embedding model 'Xenova/all-MiniLM-L6-v2' to local cache: ${env.cacheDir}`);
  await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log("Model downloaded successfully.");
}

main().catch((err) => {
  console.error("Failed to pre-download model:", err);
  process.exit(1);
});
