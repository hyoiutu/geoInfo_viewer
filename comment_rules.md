# Comment Rules（コメント・ドキュメント規約）

本ファイルは、rules.mdを分割した中でTSDoc・コメント・ドキュメントに関する規約をまとめたものです（Issue #47のレビュー対応）。TypeScript言語レベルの規約は[typescript_rules.md](./typescript_rules.md)、React/JSX固有の規約は[react_rules.md](./react_rules.md)を参照してください。

---

# biome-ignoreを使用する場合は理由を明記する

NG
```typescript
// biome-ignore lint/correctness/useExhaustiveDependencies: state更新時の再実行を防ぐため理由の記載が必要
useEffect(() => {
  // ...
}, []);
```

OK
```typescript
// biome-ignore lint/correctness/useExhaustiveDependencies: state更新時の再実行を防ぐため
useEffect(() => {
  // ...
}, []);
```

`// biome-ignore lint/<ルール名>: <理由>`の形式で、コロンの後に必ず理由を明記すること。理由の無い抑制は、割れ窓の法則（[design_principles.md](./design_principles.md)参照）に反し、後から見直す際に「なぜ抑制したか」が分からなくなる。

---

# ドキュメント・設定ファイルに特定PCのフルパス（絶対パス）を書かない

NG
```md
単体テストのルールは [test_rules.md](file:///Users/alice/repos/my-project/test_rules.md) を参照してください。
```

OK
```md
単体テストのルールは [test_rules.md](./test_rules.md) を参照してください。
```

`README.md`・`specs/`配下の仕様書・`.agents/skills/`のスキル定義等に、`/Users/<ユーザー名>/...`のような特定のPC・ユーザー環境に依存したフルパスを書き込まないこと。このリポジトリは複数人・複数PC（異なるOS・異なるユーザー名・異なる配置場所）で扱われる可能性があるため、フルパスを書くとリンク切れや誤解を招く。プロジェクト内のファイルを参照する場合は、常に参照元からの相対パス（例: `./test_rules.md`、`../../../commit_rules.md`）を使うこと。ディレクトリ構成図等で「プロジェクトルート」を示したい場合も、絶対パスではなく`./`や「プロジェクトルート」といった環境非依存の表現を使う。

---

# テスト以外の全ての関数にTSDocを書く

NG
```typescript
/**
 * アクティビティ詳細を取得する
 * @param activityId 対象のアクティビティID
 * @param options 取得オプション（includeSegments: セグメント情報を含めるか, unit: 距離の単位）
 * @return 取得結果（activity: 取得したアクティビティ, cached: キャッシュから返したか）
 */
const fetchActivityDetail = (
  activityId: number,
  options: { includeSegments: boolean; unit: 'km' | 'mile' }
): { activity: Activity; cached: boolean } => {...};
```

OK
```typescript
/** fetchActivityDetailの取得オプション */
type FetchActivityDetailOptions = {
  /** セグメント情報を含めるか */
  includeSegments: boolean;
  /** 距離の単位 */
  unit: 'km' | 'mile';
};

/** fetchActivityDetailの戻り値 */
type FetchActivityDetailResult = {
  /** 取得したアクティビティ */
  activity: Activity;
  /** キャッシュから返したか */
  cached: boolean;
};

/** アクティビティ詳細を取得する */
const fetchActivityDetail = (activityId: number, options: FetchActivityDetailOptions): FetchActivityDetailResult => {...};
```

テストコード（`__tests__/`配下・`*.tests.ts(x)`・E2Eテストの`*.spec.ts(x)`）を除く、全ての関数（`export`の有無・アロー関数/`function`宣言/クラスメソッドを問わない）に、その役割を説明するTSDocコメント（`/** ... */`）を書くこと。テストコードそのもの（アサーションを書くテストケース・spec）は対象外だが、`test-utils/`・`electron/tests/support/`・`electron/tests/global-setup.ts`のようなテストを支えるヘルパー・セットアップ処理は「テストコード」ではなく通常の関数として扱い、TSDocの対象に含める。

- 引数・戻り値が**オブジェクト型でない**場合は、通常通り`@param`・`@returns`を使ってよい。
- 引数・戻り値が**オブジェクト型の場合**は、インライン（`{ a: number; b: string }`のような直書き）のままにせず、名前付きの`type`として抽出し、各プロパティに対して個別にTSDocを書くこと。関数本体側は`@param`/`@returns`でプロパティ単位の説明を書き並べない（NG例のように「かっこ書きで列挙」しない）。
- 抽出した型の命名は、関数名を接頭辞にした`<関数名>Params`/`<関数名>Result`のような、他の型と衝突しない具体的な名前にする。
- Reactコンポーネント（`export const Foo = (props: FooProps) => {...}`）も関数の一種として扱い、コンポーネント自体の役割を1行のTSDocで説明する（個々のJSX要素にはTSDocを書かない）。
- **1つのファイルに複数のコンポーネントを定義する場合、ファイル外へexportしないローカルな子コンポーネントも例外なく本ルールの対象とする。** 子コンポーネントのpropsを`Pick<親のProps, '...'>`のように親のProps型から直接切り出して関数シグネチャにインラインで書いたり、リテラルのオブジェクト型をそのまま書いたりせず、子コンポーネント自身の名前を冠した独立した`type`（例: `ActivityListProps`）として抽出し、各プロパティにTSDocを書くこと。親のProps型のフィールドと説明文が重複しても構わない（両者は将来別々に変化しうる独立した型のため）。

---

# useEffectの直前に1行程度の説明コメントを書く

NG
```typescript
useEffect(() => {
  if (!backfillStatus?.isRunning) {
    return;
  }
  const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
  return () => clearInterval(timer);
}, [backfillStatus?.isRunning, refresh]);
```

OK
```typescript
// 実行中の間だけ、一定間隔で進捗状況をポーリングして再取得する
useEffect(() => {
  if (!backfillStatus?.isRunning) {
    return;
  }
  const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
  return () => clearInterval(timer);
}, [backfillStatus?.isRunning, refresh]);
```

`useEffect`は「いつ・何をきっかけに実行されるか」が依存配列や外側の条件分岐から読み取りにくいことが多い。全ての`useEffect`呼び出しの直前に、`//`によるコメントで「何をするeffectか」を1行程度で説明すること（TSDocの`/** */`ではなく、通常の`//`コメントでよい）。

なお、Reactコンポーネント自体の役割説明は、直前の項目（テスト以外の全ての関数にTSDocを書く）で追加するコンポーネント直上のTSDocコメントがこれを兼ねる。コンポーネントの説明を別途重複して書く必要は無い。

---

# 外部システムの仕様に起因する非自明な定数値には理由をコメントで残す

NG
```typescript
const INSERT_BATCH_SIZE = 500;
```

OK
```typescript
// 1都道府県分を1回のsave()にまとめて投入すると、TypeORMが発行するINSERT文のバインドパラメータ数が
// PostgreSQLの上限(65535個)に抵触しうる（市区町村数が多い都道府県で発生しうる）ため、この件数ごとに分割して投入する
const INSERT_BATCH_SIZE = 500;
```

定数の値そのものだけでは、それが「なぜその値なのか」「省略するとどう壊れるのか」がコードから読み取れない場合（DBのバインドパラメータ上限・外部APIのレート制限・OSやライブラリの既知の制約など、実装対象のドメインロジックではなく外部システムの仕様に起因する制約）は、値の意図をコメントで明示すること。特に「なぜこの値を超えてはいけないか」という制約の出どころ（PostgreSQL・Strava API等、具体的な対象）を明記する。
