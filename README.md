# 賃貸物件管理アプリ

資材置場、貸地、月極区画、倉庫、小規模収益物件を個人で管理するWebアプリです。物件・区画・契約、月次請求と入金、年間集計、購入候補の収益比較をPCとスマートフォンから操作できます。

## 主な機能

- Supabase Authによるログインとユーザー単位のRLS
- 物件、区画、契約、月次請求の個別CRUD
- 月次請求生成、日割り、全額・一部入金、CSV出力
- 既存の契約開始月請求を、変更前後の差額確認後に一括再計算
- ダッシュボードと年間一覧
- 契約更新日の60日前・30日前・期限超過リマインド
- 保証会社、振込口座、更新条件、解約情報、契約書類の管理
- 賃貸業務のタスクと期限一覧
- 区画の契約継続期間、空室期間、累計空室日数、稼働率
- 運用開始前の累計請求・入金額
- 過去契約からの請求履歴プレビューと遡及生成
- PostgreSQL RPCによる物件・区画・契約コードの原子的な自動採番
- 購入候補の横比較、ストレス試算、共通数値入力

## 使用技術

Next.js 16 / App Router / TypeScript / Tailwind CSS / Supabase / PostgreSQL / React Hook Form / Zod / date-fns / lucide-react / Recharts / Vitest

## 必要環境と起動

Node.js 22以上とnpmを使用します。

```bash
npm install
copy .env.local.example .env.local
npm run dev
```

`http://localhost:3000`を開きます。Supabaseの環境変数がない場合はデモモードになり、データはブラウザのlocalStorageへ保存されます。

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Supabase設定

1. Supabaseでプロジェクトを作成します。
2. SQL Editorで次を番号順に実行します。
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_purchase_candidates.sql`
   - `supabase/migrations/003_improve_settings_and_codes.sql`
   - `supabase/migrations/004_remove_actual_monthly_rent.sql`
   - `supabase/migrations/005_operations_tasks_documents.sql`
   - `supabase/migrations/006_automatic_billing.sql`
   - `supabase/migrations/007_reminder_and_relation_cleanup.sql`
   - `supabase/migrations/008_contract_initial_fees.sql`
   - `supabase/migrations/009_contract_termination_reason.sql`
   - `supabase/migrations/010_contract_and_property_refinement.sql`
3. Authentication > Users > Add userからログインユーザーを作成します。
4. `.env.local`へProject URL、anon key、service role keyを設定します。
5. 必要なら`supabase/seed.sql`先頭のUUIDを作成したユーザーIDへ置換して実行します。

既存環境では未実行のmigrationを番号順に追加実行してください。`005`は契約の保証会社・口座・更新・解約項目、tasks、reminders、attachments、非公開の契約書類Storage bucketとRLSを追加します。主要コードは`user_id`単位の一意制約で保護されます。

`006`を適用すると、ログイン時に当月の請求と入金を自動確認します。契約の「毎月の請求日」に請求を重複なく生成し、「毎月の入金予定日」に全額入金済みへ更新します。31日がない月は月末として扱います。請求・入金画面で手動修正した明細には`[手動管理]`が付き、その月は自動入金で上書きされません。

`007`はリマインダーを固定資産税・その他の賃貸管理期限に限定し、旧「任意タスク」をタスクへ移行します。契約更新・終了・保証会社更新は契約日付から自動表示されます。物件・区画・契約を削除した際は、関連するタスクとリマインダーも削除されます。

`008`は契約の礼金とフリーレント月数を追加します。礼金は契約開始月の請求収入へ一度だけ加算し、敷金は既存の預かり金項目として収益には含めません。フリーレント期間中の賃料は発生せず、日割りONの場合は賃料発生日から月末までを日割りします。

`009`は契約の終了理由を追加します。終了理由が「更新による終了」で、同一区画の次契約が翌日から始まる場合、区画の契約継続期間・空室日数・稼働率は更新前後を連続した稼働として計算します。

`010`は契約種別・終了理由・状態を整理し、保証会社マスタ、振込口座マスタ、物件の想定売却価格を追加します。既存の「継続」は「一般契約」、「退去」「解約」は「途中解約」へ移行されます。また請求処理を、設定値にかかわらず契約開始月のみ日割りし、終了月は満額とする仕様へ更新します。

## 保存仕様

初回表示では各テーブルを一括取得します。以降は変更した1レコードだけをinsert、update、deleteします。購入候補と購入前提の連続入力は500msでまとめ、同じレコードへの保存は順番に処理します。保存失敗時も入力中の表示を保持し、画面上部にエラーを表示します。

## 初期累計と遡及生成

設定画面で運用開始日、初期累計額の基準日、運用開始前の累計請求額・入金額を設定できます。ダッシュボードの累計は初期値と月次請求ログの合計です。

過去契約からの生成では終了月と入金状態を選び、対象契約数、月数、件数、総額、期間、既存請求との重複を確認してから登録します。日割り設定を反映し、契約終了月より後は生成しません。初期累計の基準日と重なる場合は二重計上警告を表示します。

## 数値入力

金額は整数で保存し、入力中も3桁カンマを表示します。全角数字、`¥`、`円`、カンマ付き貼り付けを正規化します。空欄は0として扱いますが画面上は空欄です。パーセントは画面の`10`をDB内部の`0.1`として扱います。

## 計算仕様

- 総投資額: 取得価格 + 取得諸費用 + 開発費
- 純資産: 現在評価額 - 残債
- 表面利回り: 満室月収 x 12 / 総投資額
- 未収額: max(累計請求額 - 累計入金額, 0)
- 契約開始月: 契約開始日（フリーレント設定時は賃料発生日）から月末までを暦日数で日割りし、円未満を四捨五入
- 契約開始日の翌月以降: 月額満額。契約終了月は日割りしない

既存請求は仕様変更だけでは自動更新されません。請求・入金画面の「開始月を再計算」で差額のある開始月請求を確認・選択して更新します。入金額、入金日、既存メモは保持し、請求額に応じて入金状態のみ再判定します。

## CSV

物件、区画、契約、月次請求、年間一覧からUTF-8 BOM付きCSVを出力します。日付は`YYYY-MM-DD`、請求月は`YYYY-MM`、金額はカンマなしの整数です。

## Excelインポート

ヘッダー4行目、データ5行目として物件マスター、区画マスター、契約履歴、月次請求ログを読み取ります。現在はdry-runのJSON変換とエラー表示まで対応しています。

```bash
npm run import:excel -- "C:\path\賃貸物件管理表.xlsm"
```

## Fly.io

```bash
fly secrets set NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
fly deploy
```

## ディレクトリ

- `app/`: App Router、共通CSS
- `components/`: レイアウト、画面、共通入力UI
- `lib/calculations/`: 請求・集計計算
- `lib/repositories/`: Supabase個別CRUD
- `types/`: ドメイン型
- `scripts/`: Excel変換
- `supabase/`: migrationとseed

## 現時点の制約

- Excelの本登録トランザクションは未実装で、dry-run変換までです。
- 外部通知、オンライン決済、電子契約、会計ソフト連携は対象外です。
- 初期累計額と同期間の遡及請求は自動相殺せず、警告後に利用者が選択します。
