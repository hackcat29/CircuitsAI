import { NEAR_AI_BASE_URL, NEAR_AI_MODEL } from "./config.js";
export interface InferenceEvidence {
  completionId: string;
  model: string;
  verified: boolean;
  signatureKind: string;
  verifiedAt: string;
  verificationUrl: string;
  attestation: unknown;
  signature: unknown;
}
export interface PrivateInference {
  content: string;
  inputTokens: number;
  outputTokens: number;
  evidence: InferenceEvidence;
}

/** Uses NEAR's verifier instead of treating the presence of an attestation JSON as proof. */
export async function privateInference(input: {
  prompt: string;
  apiKey: string;
  model?: string;
  maxOutputTokens?: number;
}): Promise<PrivateInference> {
  if (!input.apiKey) throw new Error("NEAR_AI_API_KEY is required");
  const sdk = await import("@nearai/inference-sdk/node");
  const verifiers = process.env.NEAR_AI_PCCS_URL
    ? {
        tdxQuote: sdk.createTdxQuoteVerifier({
          pccsUrl: process.env.NEAR_AI_PCCS_URL,
        }),
      }
    : undefined;
  const client = new sdk.InferenceClient({
    baseUrl: NEAR_AI_BASE_URL,
    apiKey: input.apiKey,
    e2ee: true,
    gatewayVerification: {
      policy: { acceptedTcbStatuses: ["UpToDate"] },
      ...(verifiers ? { verifiers } : {}),
    },
    modelVerification: {
      policy: { acceptedTcbStatuses: ["UpToDate"] },
      ...(verifiers ? { verifiers } : {}),
    },
  });
  const model = input.model ?? NEAR_AI_MODEL;
  const response = await client.chat.completions.create(
    {
      model,
      messages: [{ role: "user", content: input.prompt }],
      max_tokens: input.maxOutputTokens ?? 1024,
      stream: false,
    },
    { maxRetries: 0 },
  );
  const verified = await client.verifyResponse(response.id);
  if (verified.signatureKind !== "provider_tee")
    throw new Error(
      "Model TEE response signature required; gateway-only evidence is insufficient",
    );
  return {
    content: response.choices[0]?.message.content ?? "",
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    evidence: {
      completionId: response.id,
      model,
      verified: true,
      signatureKind: verified.signatureKind,
      verifiedAt: new Date().toISOString(),
      verificationUrl:
        "https://docs.near.ai/cloud/verification/verification-center",
      attestation: verified.attestation,
      signature: verified.signature,
    },
  };
}

export async function fetchModelAttestation(
  apiKey: string,
  model = NEAR_AI_MODEL,
) {
  const nonce = Buffer.from(
    crypto.getRandomValues(new Uint8Array(32)),
  ).toString("hex");
  const query = new URLSearchParams({
    model,
    provider: "near",
    nonce,
    include_tls_fingerprint: "false",
    signing_algo: "ecdsa",
  });
  const response = await fetch(
    `${NEAR_AI_BASE_URL}/attestation/report?${query}`,
    {
      headers: { Authorization: `Bearer ${apiKey}`, "x-no-aliasing": "true" },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok)
    throw new Error(`Attestation request failed (${response.status})`);
  const evidence = (await response.json()) as Record<string, unknown>;
  // Retrieval is public evidence for independent verification, never labeled verified here.
  return {
    model,
    nonce,
    retrievedAt: new Date().toISOString(),
    verified: false as const,
    evidence,
  };
}
