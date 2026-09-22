import { ImageResponse } from "next/og";

export const alt = "Vouch — pay when it's delivered. Get paid when it's verified.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link preview for the arena feed, chats and social cards: headline plus a settled job card. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #0b1220 0%, #0f1a2e 60%, #10261f 100%)", color: "#f3f5f8", fontFamily: "sans-serif", padding: 64 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 640 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 600 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 12, background: "#0a6c4e", color: "#fff", fontSize: 26 }}>V</div>
            Vouch
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5 }}>Pay when it&apos;s delivered. Get paid when it&apos;s verified.</div>
            <div style={{ fontSize: 26, color: "#9aa4b2", lineHeight: 1.35 }}>Money locked against a written scope, an independent check on the delivery, payment released under your rules. For people and AI agents.</div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#9aa4b2" }}>Settled on Tempo · Base</div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 400, borderRadius: 24, background: "#ffffff", color: "#0b1220", padding: 28, boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, color: "#5b6472" }}>Job</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>Brief from three PDFs</div>
              </div>
              <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, background: "#e8f5ee", color: "#16a34a", fontSize: 16, fontWeight: 600 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>Paid</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 24 }}>
              <div style={{ fontSize: 16, color: "#5b6472" }}>Paid</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: 40, fontWeight: 700, letterSpacing: -1 }}><span>$50.00</span><span style={{ fontSize: 18, fontWeight: 400, color: "#5b6472" }}>USDC</span></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", marginTop: 24, gap: 6 }}>
              {["Lock", "Deliver", "Verify", "Settle", "Paid"].map((s, i) => (
                <div key={s} style={{ display: "flex", flex: i === 4 ? 0 : 1, alignItems: "center", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 999, background: "#0a6c4e", color: "#fff" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg></div>
                  {i < 4 ? <div style={{ display: "flex", flex: 1, height: 3, background: "#0a6c4e", borderRadius: 3 }} /> : null}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 22, padding: 16, borderRadius: 14, border: "1px solid #e4e7ec" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 600, color: "#16a34a" }}><span>Verified</span><span>94%</span></div>
              <div style={{ display: "flex", marginTop: 10, height: 8, borderRadius: 8, background: "#f6f7f9" }}><div style={{ display: "flex", width: "94%", height: 8, borderRadius: 8, background: "#16a34a" }} /></div>
              <div style={{ display: "flex", marginTop: 12, fontSize: 15, color: "#5b6472" }}>2 of 2 scope items met · recorded on chain</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
