"use client";
import { useState } from "react";
import { createClient, createPublicClient, custom, http, type Address } from "viem";
import { tempoModerato } from "viem/chains";
import { encryptZoneRecipient, formatAmount, parseAmount, zonesFor } from "@vouch/shared";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Muted } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/field";
import { TxLink } from "@/components/ui/tx-link";
import { useToast } from "@/components/ui/toast";
import { api, ClientError } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { signTypedData } from "@/lib/client/wallet";

type ZoneInfo = { chainId: number; zone: { zoneId: number; name: string; chainId: number; rpcUrl: string; portal: Address; allowed: boolean; legacy: boolean }; vault: Address; testnetOnly: boolean };

/**
 * F12 (testnet-only): send an available balance into Tempo Zone A privately. The recipient (you) and the memo are
 * encrypted to the zone sequencer in the browser with viem; the Vault calls the portal; the public chain shows only
 * Vault → Portal and the amount. Afterwards the zone balance is read with a signed authorisation token.
 */
export function ZonePayout({ chainId, token, symbol, available }: { chainId: number; token: Address; symbol: string; available: string }) {
  const toast = useToast();
  const { address, getProvider } = useAuth();
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ tx: string; zone: string } | null>(null);
  const [zoneBalance, setZoneBalance] = useState<string | null>(null);
  const zone = zonesFor(chainId)[0];
  if (!zone || chainId !== 42431) return null;

  const send = async () => {
    setErr(null);
    if (!address) return setErr("Your wallet is still being created.");
    let base: bigint;
    try { base = parseAmount(amount); } catch (e) { return setErr(e instanceof Error ? e.message : "Enter an amount."); }
    if (base <= 0n || base > BigInt(available)) return setErr(`Enter up to ${formatAmount(available)}.`);
    setBusy(true);
    try {
      const info = await api<ZoneInfo>(`/withdraw/zone?chainId=${chainId}&zoneId=${zone.zoneId}`);
      if (!info.zone.allowed) throw new ClientError("This zone is not enabled on the vault yet.", "zone_disabled");
      // 1. Encrypt the recipient (you) + memo for the sequencer, bound to the vault as the portal caller
      //    (legacy portals predate that binding and use the older scheme; the vault says which one this is).
      const { Actions } = await import("viem/tempo");
      const pub = createPublicClient({ chain: tempoModerato, transport: http() });
      const { keyIndex, publicKey } = await Actions.zone.getEncryptionKey(pub, { zoneId: zone.zoneId, portalAddress: info.zone.portal });
      const encrypted = await encryptZoneRecipient({ sequencerKey: publicKey, recipient: address, sender: info.vault, portal: info.zone.portal, keyIndex, legacy: info.zone.legacy });
      // 2. Sign the ZoneWithdraw authorisation (binds portal, token, amount, key index and payload hash).
      const qs = new URLSearchParams({ chainId: String(chainId), zoneId: String(zone.zoneId), token, amount: base.toString(), keyIndex: keyIndex.toString(), encrypted: JSON.stringify(encrypted) });
      const { typedData } = await api<ZoneInfo & { typedData: Parameters<typeof signTypedData>[2] }>(`/withdraw/zone?${qs}`);
      const provider = await getProvider();
      if (!provider) throw new Error("Your wallet is not ready yet.");
      const signature = await signTypedData(provider, address, typedData);
      // 3. Relay.
      const r = await api<{ tx: string; zone: string }>("/withdraw/zone", { method: "POST", json: { chainId, zoneId: zone.zoneId, token, amount: base.toString(), keyIndex: keyIndex.toString(), encrypted, signature } });
      setDone(r);
      toast({ title: "Sent privately", body: `Your ${symbol} is on its way into ${r.zone}. Only the amount is visible on the public chain.`, tone: "success" });
      // 4. Read the private balance with a signed authorisation token (only you can see it).
      // the token embeds the chain id it is valid for: sign it for the zone chain, not the Tempo L1
      const zoneChain = { ...tempoModerato, id: zone.chainId, name: zone.name, rpcUrls: { default: { http: [zone.rpcUrl] } } };
      const wallet = createClient({ account: address, chain: zoneChain, transport: custom(provider) });
      const { token: authToken } = await Actions.zone.signAuthorizationToken(wallet, { zoneId: zone.zoneId, chain: zoneChain });
      const zoneClient = createPublicClient({ chain: zoneChain, transport: http(zone.rpcUrl, { fetchOptions: { headers: { "X-Authorization-Token": authToken } } }) });
      for (let i = 0; i < 20; i++) {
        await new Promise((res) => setTimeout(res, 6000));
        const bal = await zoneClient.readContract({ address: token, abi: [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] }], functionName: "balanceOf", args: [address], account: address }).catch(() => null);
        if (bal != null && bal > 0n) { setZoneBalance(bal.toString()); break; }
      }
    } catch (e) {
      const ce = e instanceof ClientError ? e : null;
      setErr(ce ? `${ce.message} ${ce.next ?? ""}` : e instanceof Error ? e.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-4 border-dashed">
      <CardTitle>Send privately to {zone.name} <span className="ml-2 rounded-[var(--r-pill)] bg-accent/20 px-2 py-0.5 text-[11px] font-medium text-warn">testnet</span></CardTitle>
      <Muted className="mt-1">Tempo Zones keep balances and transfers off the public chain. Your funds move from the vault into the zone; who received them and the job reference are encrypted. Only the amount is public.</Muted>
      <Field className="mt-3" error={err}>
        <Label htmlFor="zone-amt" hint={`up to ${formatAmount(available)}`}>Amount</Label>
        <Input id="zone-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </Field>
      <Button full variant="secondary" loading={busy} onClick={send}>Send to {zone.name}</Button>
      {done ? (
        <div className="mt-3 text-[13px]">
          <div><TxLink chainId={chainId} hash={done.tx} label="Vault → Zone Portal" /></div>
          <Muted className="mt-1">{zoneBalance ? `Your private balance in ${zone.name}: ${formatAmount(zoneBalance)} ${symbol} (visible only with your signature).` : "The zone credits you once the sequencer processes the deposit; checking…"}</Muted>
        </div>
      ) : null}
    </Card>
  );
}
