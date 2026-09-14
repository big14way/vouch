import type { Hex } from "viem";
import { db } from "../db";
import { decrypt, encrypt } from "../secrets";

export interface JobSecretValue {
  amount: bigint;
  salt: Hex;
}

export async function storeSecret(jobId: string, v: JobSecretValue): Promise<void> {
  await db.jobSecret.upsert({
    where: { jobId },
    create: { jobId, amountEnc: encrypt(v.amount.toString()), saltEnc: encrypt(v.salt) },
    update: { amountEnc: encrypt(v.amount.toString()), saltEnc: encrypt(v.salt) },
  });
}

/** Decrypted only to build calldata or to show the amount to a party. */
export async function decryptSecret(jobId: string): Promise<JobSecretValue> {
  const row = await db.jobSecret.findUnique({ where: { jobId } });
  if (!row) throw new Error(`no secret for job ${jobId}`);
  return { amount: BigInt(decrypt(row.amountEnc)), salt: decrypt(row.saltEnc) as Hex };
}
