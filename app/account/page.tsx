import AccountInput from "@/components/AccountInput";

export const metadata = { title: "Account — RiseScreener" };

export default function AccountPage() {
  return (
    <div
      className="screen"
      data-page="account-tracker"
      style={{ minHeight: "62vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 22 }}
    >
      <span style={{ width: 96, height: 96, borderRadius: "calc(var(--radius)*0.74)", overflow: "hidden", border: "1px solid var(--accent-line)", boxShadow: "0 0 0 5px var(--accent-soft), 0 20px 50px -18px rgba(0,0,0,.8)", background: "var(--brand-green)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rise-avatar.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </span>
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em" }}>
          Account <span className="text-accent">Explorer</span>
        </h1>
        <p style={{ margin: "12px auto 0", fontSize: 13.5, color: "var(--muted)", maxWidth: 460, lineHeight: 1.55 }}>
          Paste any wallet address to see its account value, open positions, pending orders, fills and on-chain transactions on RISEx.
        </p>
      </div>
      <AccountInput />
    </div>
  );
}
