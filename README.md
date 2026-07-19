# 賃貸物件管理アプリ

資材置場、貸地、月極区画、倉庫、小規模収益物件を個人で管理するNext.jsアプリです。物件・区画・契約のCRUD、月次請求生成、入金消込、未収管理、年間一覧、CSV出力、収益集計をPCとスマートフォンから操作できます。

Supabase未設定時はデモモードになり、指示書の3物件・3区画・3契約・2026年4月入金実績をブラウザのlocalStorageへ保存します。

## 使用技術

Next.js 16 / App Router / TypeScript / Tailwind CSS / Supabase (PostgreSQL, Auth, RLS) / React Hook Form / Zod / date-fns / lucide-react / Recharts / Vitest

## セットアップ

Node.js 22以上とnpmを用意します。

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

`http://localhost:3000`を開きます。確認コマンドは次の通りです。

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Supabase

1. Supabaseでプロジェクトを作成します。
2. SQL Editorで`supabase/migrations/001_initial.sql`を実行します。
3. Authentication > Users > Add userからメールアドレスとパスワードを登録します。
4. `.env.local`へProject URL、anon key、service role keyを設定します。
5. `supabase/seed.sql`先頭のUUIDを作成したユーザーIDへ置換して実行します。

全テーブルでRLSが有効です。`properties`、`units`、`contracts`、`monthly_charges`、`app_settings`は`auth.uid() = user_id`、`profiles`は`auth.uid() = id`の行だけ操作できます。請求生成RPCもログインユーザーの契約だけを処理します。

現状の画面データ層はデモモードへ接続されています。Supabaseスキーマ、SSRクライアント、認証画面、請求生成Route Handlerは実装済みですが、画面CRUDのSupabase永続化への切替は残課題です。

## 計算仕様

- 総投資額: 取得価格 + 取得諸費用 + 開発費
- 純資産: 現在評価額 - 残債
- 表面利回り: 満室月収 x 12 / 総投資額
- 現在利回り: 現在月収 x 12 / 総投資額
- 未収額: max(請求額 - 入金額, 0)
- 日割OFF: 対象月に1日でも在籍すれば満額
- 日割ON: 開始月・終了月の在籍日数 / 暦日数、円未満四捨五入
- 請求月は常に月初日として保存

## CSV

物件、区画、契約、月次請求、年間一覧からUTF-8 BOM付きCSVを出力します。日付は`YYYY-MM-DD`、請求月は`YYYY-MM`、金額はカンマなしの整数です。

## Excelインポート

ヘッダー4行目、データ5行目として、物件マスター・区画マスター・契約履歴・月次請求ログを読みます。空ID行を除外し、日付・金額・真偽値・契約状態を正規化します。

```bash
npm run import:excel -- "C:\path\賃貸物件管理表.xlsm"
```

現在はdry-runのJSON変換、件数、外部キー不一致の表示までです。`--commit`は中途半端な登録を防ぐため意図的に停止し、本登録には未対応です。

## Fly.io

```bash
fly launch --no-deploy
fly secrets set NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
fly deploy
```

東京リージョン`nrt`、1GB shared CPU、HTTPS、自動停止・自動起動を`fly.toml`に設定しています。アプリ名はFly.io上で一意な名前へ変更してください。

## 構成

- `app/`: App Routerページ、請求生成API
- `components/`: レイアウト、共通UI、各機能画面
- `lib/`: 計算、検証、表示、Supabaseクライアント、デモデータ
- `types/`: ドメイン型
- `scripts/`: Excel変換
- `supabase/`: マイグレーションとシード

## 現時点の制約

- Excel本登録トランザクションは未実装です。
- Supabase設定時の画面CRUD切替と実認証ガードは未接続です。
- 月別推移グラフと物件詳細専用ページは未実装です。
- デモログインは入力形式の確認用で、Supabase未設定時に認証を強制しません。
