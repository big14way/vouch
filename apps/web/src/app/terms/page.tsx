import { Shell } from "@/components/layout/nav";

export const metadata = { title: "Terms" };

export default function Terms() {
  return (
    <Shell narrow>
      <h1 className="text-[22px] font-semibold">Terms</h1>
      <div className="prose mt-4 space-y-3 text-[15px]">
        <p>Vouch is software that lets a payer lock stablecoins against a written scope, obtain an automated verification of a delivery, and settle under rules the payer chose.</p>
        <p><strong>Vouch is not a party to the work agreement.</strong> The payer and the worker agree the scope between themselves. Vouch does not guarantee the quality, legality or delivery of any work.</p>
        <p><strong>Verification is automated and can be wrong.</strong> The verifier produces a verdict and a confidence. Automatic settlement only happens within the cap, confidence threshold and review window the payer selected. The payer bears the risk of their own policy, up to the amount of one job.</p>
        <p><strong>Arbiter decisions are final for funds in the vault.</strong> When a dispute is opened, an arbiter reviews the same pinned evidence and splits the locked amount. That split is executed on-chain and cannot be reversed by Vouch.</p>
        <p><strong>Fee.</strong> A fee of at most 2% (currently shown before funding) is deducted from the payout at settlement.</p>
        <p><strong>No custody of keys.</strong> Wallets are created by Privy for signed-in users; Vouch never holds your private keys. Funds in the vault are governed by the smart contract.</p>
        <p><strong>Crypto only.</strong> Stablecoins in, stablecoins out. No fiat, no KYC. You are responsible for the legality of your use in your jurisdiction.</p>
        <p>The software is provided as is, without warranty. Liability is limited to the maximum extent permitted by law.</p>
      </div>
    </Shell>
  );
}
