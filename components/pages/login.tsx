"use client";

import { useState } from "react";
import { Building2, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <Building2 />
          <div>
            <h1>賃貸管理</h1>
            <p>物件・契約・入金をひとつに</p>
          </div>
        </div>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setLoading(true);
            if (!supabase) {
              setError("Supabaseが設定されていません");
              setLoading(false);
              return;
            }
            const result = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (result.error) {
              setError("メールアドレスまたはパスワードが正しくありません");
              setLoading(false);
              return;
            }
            window.location.href = "/";
          }}
        >
          <label>
            メールアドレス
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@example.com"
            />
          </label>
          <label>
            パスワード
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary" disabled={loading}>
            <LogIn />
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </section>
    </main>
  );
}
