import type { Account } from "near-api-js";
import { createHash } from "node:crypto";
import { NearClient } from "./client.js";
import { accountId } from "./config.js";
export interface CommerceAgent {
  owner: string;
  balance: string;
  max_per_job: string;
  daily_limit: string;
  providers: string[];
  spent_day: number;
  spent: string;
  completed: number;
  disputed: number;
  paused: boolean;
}
export interface CommerceJob {
  id: string;
  buyer: string;
  provider: string;
  amount: string;
  task_hash: string;
  deliverable_hash: string | null;
  deadline: string;
  status: "Funded" | "Delivered" | "Disputed" | "Completed" | "Refunded";
}
export const hashContent = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export class NearCommerce {
  constructor(
    readonly client: NearClient,
    readonly contract: string,
  ) {
    accountId(contract);
  }
  agent(id: string) {
    return this.client.view<CommerceAgent | null>(this.contract, "get_agent", {
      agent_id: accountId(id),
    });
  }
  job(id: string) {
    return this.client.view<CommerceJob | null>(this.contract, "get_job", {
      job_id: id,
    });
  }
  async postJob(
    runtime: Account,
    input: {
      provider: string;
      amountMicros: string;
      task: string;
      deadline: Date;
    },
  ) {
    return this.client.call<string>(runtime, runtime.accountId, "post_job", {
      provider: accountId(input.provider),
      amount: input.amountMicros,
      task_hash: hashContent(input.task),
      deadline: (BigInt(input.deadline.getTime()) * 1_000_000n).toString(),
    });
  }
  deliver(runtime: Account, jobId: string, output: string) {
    return this.client.call(runtime, runtime.accountId, "deliver", {
      job_id: jobId,
      deliverable_hash: hashContent(output),
    });
  }
  release(runtime: Account, jobId: string) {
    return this.client.call(runtime, runtime.accountId, "release", {
      job_id: jobId,
    });
  }
  dispute(runtime: Account, jobId: string) {
    return this.client.call(runtime, runtime.accountId, "open_dispute", {
      job_id: jobId,
    });
  }
  depositTransaction(agentId: string, tokenId: string, amountMicros: string) {
    if (!/^[1-9]\d*$/.test(amountMicros))
      throw new Error("Positive USDC base units required");
    return {
      receiverId: accountId(tokenId),
      method: "ft_transfer_call",
      args: {
        receiver_id: this.contract,
        amount: amountMicros,
        msg: JSON.stringify({ deposit_for: accountId(agentId) }),
      },
      gas: "120000000000000",
      deposit: "1",
    };
  }
}
