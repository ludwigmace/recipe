import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const modelId = process.env.LLM_MODEL;
const apiKey = process.env.LLM_KEY;
const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 120_000);

if (!modelId || !apiKey || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
  console.error(
    "Set LLM_MODEL and LLM_KEY, and make sure LLM_TIMEOUT_MS is a positive integer.",
  );
  process.exit(1);
}

async function readModelCatalog(fileName) {
  const filePath = path.join(process.cwd(), fileName);

  try {
    const catalog = JSON.parse(await readFile(filePath, "utf8"));
    return Array.isArray(catalog) ? catalog : catalog.models ?? [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error(`Could not read ${fileName}: ${error.message}`);
  }
}

async function findModel(modelName) {
  for (const fileName of ["opencode-models.json", "opencodego-models.json"]) {
    const models = await readModelCatalog(fileName);
    const model = models.find((entry) => entry.id === modelName);
    if (!model) continue;

    const chatApi = model.apis?.find(
      (api) => api.protocol === "chat-completions",
    );
    if (chatApi?.endpoint) return { endpoint: chatApi.endpoint };

    const baseUrl = model.api?.["chat-completions"]?.base_url;
    if (baseUrl) {
      return {
        endpoint: `${baseUrl.replace(/\/+$/, "")}/chat/completions`,
      };
    }

    throw new Error(
      `Model "${modelName}" is listed in ${fileName}, but has no chat-completions API.`,
    );
  }

  throw new Error(
    `Model "${modelName}" was not found in opencode-models.json or opencodego-models.json.`,
  );
}

try {
  const { endpoint } = await findModel(modelId);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "user-agent": "recipes-llm-smoke-test/1.0",
      "x-opencode-session": randomUUID(),
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        {
          role: "user",
          content: "Reply with exactly: LLM test succeeded",
        },
      ],
      max_tokens: 64,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorBody = (await response.text()).slice(0, 1000);
    throw new Error(`LLM request failed (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content;

  if (typeof text !== "string" || text.length === 0) {
    throw new Error("LLM responded successfully but returned no message text.");
  }

  console.log(`LLM test succeeded (${modelId}):`);
  console.log(text);
} catch (error) {
  const isTimeout =
    error.name === "TimeoutError" || /timed? ?out|timeout/i.test(error.message);

  if (isTimeout) {
    console.error(
      `LLM request timed out after ${timeoutMs} ms. Set LLM_TIMEOUT_MS to increase the limit.`,
    );
    process.exitCode = 1;
  } else {
    console.error(`LLM test failed: ${error.message}`);
    process.exitCode = 1;
  }
}
