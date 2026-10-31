import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  create: vi.fn(),
  verify: vi.fn(),
  options: vi.fn(),
}));
vi.mock("@nearai/inference-sdk/node", () => ({
  InferenceClient: class {
    chat = { completions: { create: state.create } };
    constructor(options: unknown) {
      state.options(options);
    }
    verifyResponse = state.verify;
  },
}));
import { privateInference } from "../src/ai.js";
beforeEach(() => {
  vi.clearAllMocks();
  state.create.mockResolvedValue({
    id: "completion",
    choices: [{ message: { content: "Private result" } }],
    usage: { prompt_tokens: 10, completion_tokens: 4 },
  });
});
describe("verified NEAR AI", () => {
  it("requires an API key before making a paid call", async () => {
    await expect(
      privateInference({ apiKey: "", prompt: "test" }),
    ).rejects.toThrow("required");
    expect(state.create).not.toHaveBeenCalled();
  });
  it("requires encrypted inference and current TCB status", async () => {
    state.verify.mockResolvedValue({
      signatureKind: "provider_tee",
      attestation: { tcbStatus: "UpToDate" },
      signature: {},
    });
    const result = await privateInference({
      apiKey: "test-key",
      prompt: "test",
    });
    expect(state.options).toHaveBeenCalledWith(
      expect.objectContaining({
        e2ee: true,
        gatewayVerification: { policy: { acceptedTcbStatuses: ["UpToDate"] } },
        modelVerification: { policy: { acceptedTcbStatuses: ["UpToDate"] } },
      }),
    );
    expect(result.evidence.verified).toBe(true);
    expect(result.content).toBe("Private result");
  });
  it("rejects gateway-only evidence", async () => {
    state.verify.mockResolvedValue({ signatureKind: "gateway" });
    await expect(
      privateInference({ apiKey: "test-key", prompt: "test" }),
    ).rejects.toThrow("Model TEE");
  });
  it("returns no text if response verification fails", async () => {
    state.verify.mockRejectedValue(new Error("signature mismatch"));
    await expect(
      privateInference({ apiKey: "test-key", prompt: "sensitive test prompt" }),
    ).rejects.toThrow("signature mismatch");
    expect(state.create).toHaveBeenCalledTimes(1);
  });
});
