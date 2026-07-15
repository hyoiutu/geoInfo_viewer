# コード規約

本ファイルには、コードを書く際に常に参照する基礎的な規約（構文レベルのTypeScript/React規約、コメント・命名等）をまとめています。以下は関連するが参照頻度がより低い規約のため、別ファイルに分割しています（Issue #47。rules.mdが1000行を超え全てを都度参照するのは非効率という指摘を受け、参照するタイミングに応じてファイルを分けた）。

- [design_principles.md](./design_principles.md): DRY/KISS/YAGNI・SOLID原則等の設計原則。モジュール分割やリファクタリングを判断する場面で参照する。
- [ui_rules.md](./ui_rules.md): Chakra UI・色/余白トークン等のスタイリング規約。フロントエンドのUIコンポーネントを実装・変更する場合のみ参照する。

機械的にチェックできる規約は、Biome（`pnpm run lint`）または専用スクリプト（`pnpm run check:type-assertions`・`pnpm run check:file-size`）に移行済みで、該当する規約は本ファイルでは詳細な例を省き参照先のみを示す。

# Biomeの自動チェックがカバーしない範囲について

本プロジェクトのBiome設定（`biome.json`）は、以下のルールの一部しか自動検出できない。

- **マジックナンバー**: Biomeの`noMagicNumbers`は比較・算術式に使われる数値リテラル（例: `if (count > 3)`）は検出するが、オブジェクトリテラルのプロパティ値（例: `{ width: 1200 }`）のような設定値としての数値リテラルは検出しない。
- **KISS（if-elseの簡略化等）**: 自動検出の対象外。単純な`if/else`を三項演算子にできる、ネストを減らせる等はBiomeの指摘に出ないため、コードレビュー時に人間・AIエージェントが個別に見直す必要がある（[design_principles.md](./design_principles.md)参照）。

**Biomeが指摘しないからといって、規約に準拠しているとは限らない。** 新規コード作成時・既存コードの見直し時は、Biomeのlint結果だけに頼らず、本ファイル・[design_principles.md](./design_principles.md)・[ui_rules.md](./ui_rules.md)の各ルールと照らし合わせて確認すること。

逆に、**Biomeの指摘が誤りである場合もある**。例えばNestJSのコンストラクタインジェクションで使うクラス（例: `constructor(private readonly appService: AppService) {}`）は、Biomeの`lint/style/useImportType`からは「型としてしか使われていない」ように見え`import type`への変換を提案されるが、実際には`emitDecoratorMetadata`が実行時にこのクラスの参照（値）を必要とするため、`import type`に変換すると依存性注入が壊れる。この種の警告（`Found N warning(s)`、exit code 0）は自動修正を鵜呑みにせず、フレームワークの実行時要件を優先すること。

---

# 未使用の引数・変数は残さない

Biomeの`noUnusedFunctionParameters`・`noUnusedVariables`が自動検出する。未使用の関数引数は`_`（アンダースコア）へのリネームが提案される。

```typescript
// OK
const func = (_, args) => {
  console.log(args);
};
```

# テスト以外はTypeScriptファイルを使用する

JavaScriptファイル（`.js`/`.jsx`）は使用せず、TypeScriptファイル（`.ts`/`.tsx`）を使用し、適切な型定義を行う。

# React Hooksの依存配列を無視しない

Biomeの`useExhaustiveDependencies`が自動検出する。依存配列を意図的に省略する場合は、次項の「biome-ignoreを使用する場合は理由を明記する」に従うこと。

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

# anyやas（型キャスト）は原則使用しない

`any`の使用はBiomeの`noExplicitAny`が自動検出する。

`as`による型キャストはBiomeの自動チェック対象外のため、以下のルールに従うこと。

NG
```typescript
const user = {} as User;
```

OK
```typescript
const user: User = { id: 1, name: "name" };
```

`as unknown as T`のように型システムを迂回して無理やりキャストすることは、原則・例外を問わずいかなる場合も禁止する。「正しい型を見つけるのが面倒／複雑に見える」ことはキャストを正当化する理由にならない。型が合わないと感じた場合は、次の手順で正しい型を特定してから使うこと。
- ライブラリが提供する型が期待と違う場合、そのライブラリが依存する別パッケージ（transitive dependency）が本来の型を公開していないか確認する（例: `maplibre-gl`の式(expression)の型は`maplibre-gl`自身からは再エクスポートされていないが、依存先の`@maplibre/maplibre-gl-style-spec`が`ExpressionSpecification`等として公開している）。見つかった場合はそのパッケージをdevDependenciesに明示的に追加してimportする。
- 配列・タプルリテラルがユニオン型に一致しないというエラーが出る場合、変数宣言に型注釈を付けて「期待される型」をTypeScriptに伝える（コンテキスト型を与える）ことで解消できることが多い。キャストの前に必ず試すこと。
- ライブラリの関数がジェネリック引数を取るオーバーロードを持っていないか確認する（例: `maplibre-gl`の`Map#getSource`は`getSource(id: string): Source | undefined`だけでなく`getSource<TSource extends Source>(id: string): TSource | undefined`という宣言も持っており、`map.getSource(id) as maplibregl.GeoJSONSource`と書く代わりに`map.getSource<maplibregl.GeoJSONSource>(id)`と書けばキャスト無しで済む）。ライブラリの型定義ファイル（`node_modules`配下の`.d.ts`）を実際に検索し、同名メソッドの別シグネチャが無いか確認すること。
- 既存の配列・オブジェクトの要素の型が広すぎる（例: geojsonの`Position`型は`number[]`で、緯度経度2要素のタプルより広い）場合、`.map()`等で各要素から明示的に狭い型（タプル等）を組み立てる変換関数を挟むことでキャストを避けられる（例: `const toLngLat = (position: Position): [number, number] => [position[0], position[1]]`）。

上記の回避手順を試した上でなお`as T`によるキャストが避けられないと判断した場合は、**そのキャストの直前に、なぜ回避できないのか（どの回避手順を試して駄目だったか）を説明する`//`コメントを必ず添えること。** コメント無しの型キャストは、理由を検討せず安易に使った結果なのか、検討した上でやむを得ず使ったのかが後から判別できず、レビューのたびに同じ確認が発生してしまう。

本ルールはBiomeの自動チェック対象外のため、`pnpm run check:type-assertions`（`scripts/check-type-assertions.mjs`）で機械的に検出できる。`as unknown as T`（括弧で挟んだ場合を含む）は無条件でエラーとし、それ以外の`as T`は直前行または同一行末尾に`//`コメントが無い場合にエラーとする（`as const`・`import { x as y }`の別名importは対象外）。`package.json`の`lint-staged`（huskyのpre-commitフック経由）に組み込み済みで、コミット対象ファイルに対して自動実行される（Issue #48）。

# ||ではなく??（Null合体演算子）を使用する

NG
```typescript
const result = value1 || value2;
```

OK
```typescript
const result = value1 ?? value2;
```

# 型定義には原則typeを使用する

型定義に`type`を使用することはBiomeの`useConsistentTypeDefinitions`が自動検出する。

**例外1: バックエンドのHTTPレスポンスとして返す型は`class`とし`@ApiProperty()`を付与する。**

NG
```typescript
// レスポンスとして使う型をtypeのままにすると、Swaggerのスキーマ自動抽出(@nestjs/swagger)が
// プロパティ単位の詳細を取得できず、生成されるSwagger UIのスキーマが{"type": "object"}という
// 空の情報になってしまう。
export type HealthStatus = {
  status: 'ok';
};
```

OK
```typescript
import { ApiProperty } from '@nestjs/swagger';

export class HealthStatus {
  @ApiProperty({ description: 'サーバーが正常に起動していることを表す固定値', enum: ['ok'] })
  status!: 'ok';
}
```

NestJSのコントローラーメソッドが返す型（DTO）は、`@nestjs/swagger`のコンパイラプラグインによるスキーマ自動抽出のため、原則として`class`で定義し各プロパティに`@ApiProperty()`を付与すること。これは一時的な例外ではなく標準のルールであるため、`class`を使う理由をコード中にコメントで説明する必要は無い（TypeORM Entityが同じ理由で`class`を使っているのと同様の技術的制約であり、本ルールの対象は「HTTPレスポンスとして直接返る型」のみ。それ以外の内部的な型定義には引き続き`type`を使う）。

限定された文字列・数値の集合を取りうるプロパティ（例: `errorCode`のようなUnion型）は、`@ApiProperty()`に`enum`オプションを付与し、取りうる値をSwagger上でも確認できるようにすること。

他ブランチの変更（他Issue対応・レビュー対応等）をマージ・rebaseで取り込んだ際は、新たに追加・変更されたレスポンス型に`@ApiProperty()`の付与漏れが無いか確認すること。マージ作業を終えたら、`nest build`後にバックエンドを実際に起動し`/api-json`のレスポンスで該当スキーマ（`components.schemas`）の中身が空になっていないか確認するのが確実。

**例外2: 既存の`interface`へ宣言をマージ(declaration merging)する必要がある場合は`interface`を使う。** `type`エイリアスは宣言のマージができないため、代替できない（例: `frontend/src/vite-env.d.ts`の`ImportMetaEnv`は、Viteが`vite/client`の型定義で宣言した`interface ImportMetaEnv`に独自の環境変数プロパティをマージするために`interface`を使う必要がある）。Biomeの`useConsistentTypeDefinitions`警告が出るため、該当箇所には理由を示す`biome-ignore`コメントを付けること。

# 三項演算子はネストしない

Biomeの`noNestedTernary`が自動検出する。

# 命名規則の遵守

Biomeの`useNamingConvention`が自動検出する。

# boolean型の属性値は省略する

NG
```typescript
<Component personal={true} />
```

OK
```typescript
<Component personal />
```

# 型推論が効く場合は型注釈を省略する

Biomeの`noInferrableTypes`が自動検出する。

# マジックナンバー・マジックストリングを使用しない

NG
```typescript
if (retryCount > 3) {
  // ...
}

if (file.dateSource === 'metadata') {
  // ...
}
```

OK
```typescript
const MAX_RETRY_COUNT = 3;
if (retryCount > MAX_RETRY_COUNT) {
  // ...
}

const DATE_SOURCE_METADATA = 'metadata';
if (file.dateSource === DATE_SOURCE_METADATA) {
  // ...
}
```

比較・算術式の数値リテラルはBiomeの`noMagicNumbers`が検出するが、オブジェクトリテラルのプロパティ値等の設定値としての数値リテラルは検出しないため、その場合も定数化すること（詳細は「Biomeの自動チェックがカバーしない範囲について」参照）。

文字列のマジックナンバー（マジックストリング）も同様に定数化する。ただしUnion型で表現され型チェッカーが誤り（typo）を検出できる値（例: `'video' | 'image'`のような限定されたリテラル型同士の比較）は対象外とする。

# importは自動ソートする・named exportを使用する

importの並び順はBiomeの`organizeImports`（`pnpm run lint:fix`で自動修正）が、`export default`の禁止はBiomeの`noDefaultExport`が、それぞれ自動検出・修正する。

# objectのキー名と変数名が同じ場合は省略記法を使用する

NG

```typescript
const user = {
  name: name,
  age: age,
};
```

OK

```typescript
const user = {
  name,
  age,
};
```

# Reactコンポーネントは自己閉じタグを使用する

Biomeの`useSelfClosingElements`が自動検出する。

# JSX内に複数行のロジックを書かない

JSX（return文の中）に書いてよいのは関数呼び出しと1行程度の式（単純な三項演算子やテンプレートリテラル等）のみとする。複数行にわたる条件分岐やイベントハンドラの本体はコンポーネント本体側の関数として外に出す。

NG

```tsx
return (
  <div>
    {items.length === 0 ? (
      <p>Emptyです</p>
    ) : (
      items.map((item) => <Item key={item.id} item={item} />)
    )}
    <button
      onClick={() => {
        setCount((current) => current + 1);
        logEvent('increment');
      }}
    >
      +1
    </button>
  </div>
);
```

OK

```tsx
const handleIncrement = () => {
  setCount((current) => current + 1);
  logEvent('increment');
};

return (
  <div>
    <ItemList items={items} />
    <button onClick={handleIncrement}>+1</button>
  </div>
);
```

# アロー関数を使用する

Biomeの`useArrowFunction`が自動検出する。

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

# IDのような識別子は、数値比較・演算の予定が無いならstring型で持つ

NG
```ts
@PrimaryColumn({ type: 'bigint', transformer: bigintNumberTransformer })
id!: number;
```

OK
```ts
@PrimaryColumn({ type: 'bigint' })
id!: string;
```

外部サービスのIDやDBの主キーなど、値そのものに対して大小比較・加算等の数値演算を行う予定が無い識別子は、素直に`string`型で扱うこと。「数値っぽい見た目」というだけで`number`型にすると、以下のような不要な複雑さが生まれる。

- PostgreSQLの`bigint`型カラムはJSの`number`（`Number.MAX_SAFE_INTEGER`）で安全に表現できない桁数を許容するため、pgドライバは`bigint`列を文字列で返す。`number`として扱うにはTypeORMのtransformerで相互変換する実装が必要になり、その分のコード・見落としリスクが増える。
- 識別子は本来「値が一致するかどうか」だけが意味を持ち、大小比較や算術演算の対象にはならない。`string`のまま扱えばDBドライバの自然な表現と一致し、変換コードが一切不要になる。

数値型の外部API（例: Strava API）から取得したIDを取り込む場合は、その境界（Entity等への変換処理）でのみ`String(...)`変換を行い、自分たちのDB・DTO・フロントエンドの内部では一貫して`string`として扱う。

---

# エラーはconsole.logや握りつぶしで終わらせず、型付きの例外として伝播させる

NG
```ts
// バックエンド
try {
  await this.stravaActivitiesService.fetchCyclingActivities();
} catch {
  return { success: false }; // 何が起きたか呼び出し元には分からない
}

// フロントエンド
try {
  await fetchCyclingActivities();
} catch (error) {
  console.error('取得に失敗しました', error); // ユーザーには何も伝わらない
}
```

OK
```ts
// バックエンド: 意図的に投げる例外はAppException(またはそのサブクラス)として扱う
try {
  await this.httpService.get(url);
} catch (error) {
  throw toStravaApiException(error); // errorCode/message/hintを持つ例外に変換
}

// フロントエンド: エラーダイアログ等でユーザーに種別・対処法を提示する
try {
  await fetchCyclingActivities();
} catch (error) {
  onError(toAppErrorInfo(error));
}
```

バックエンドは、意図的に発生しうるエラー（外部API呼び出し失敗等）を`AppException`（`backend/src/common/errors/`参照）として投げ、グローバル例外フィルタ（`AllExceptionsFilter`）が全エンドポイント共通の`{errorCode, message, hint}`形式にレスポンスを統一する。個別のtry/catchで`{success: false}`のような真偽値に握りつぶし、エラーの種別・原因を消してしまわないこと（ただし「バックフィル実行中だから同期をスキップした」のような、エラーではない正常系のガードは真偽値の戻り値のままでよい）。

フロントエンドは、APIレスポンスが異常な場合`ApiError`（`frontend/src/utils/apiError.ts`参照）としてthrowし、呼び出し元でconsole.error等に記録するだけで終わらせず、エラーダイアログ等でユーザーに`message`（内容）と`hint`（対処法）を提示すること。詳細は[system_specification.md](./specs/system_specification.md)の「エラーハンドリング機構」節を参照。

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

---

# サードパーティライブラリがDOM要素を要求する場合、innerHTMLへの文字列注入ではなくReactのcreateRootで管理下に置く

NG
```typescript
import { renderToStaticMarkup } from 'react-dom/server';

const createMarkerElement = (icon: ReactElement): HTMLDivElement => {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(icon);
  return container;
};
```

OK
```typescript
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

const createMarkerElement = (icon: ReactElement): { element: HTMLDivElement; root: Root } => {
  const container = document.createElement('div');
  const root = createRoot(container);
  flushSync(() => root.render(icon));
  return { element: container, root };
};

// 呼び出し側: 破棄する際にroot.unmount()も呼ぶこと（メモリリーク防止）
```

MapLibreの`Marker`等、React管理外のライブラリが独自にDOM要素（`HTMLElement`）を要求するAPIでは、`document.createElement`によるコンテナ生成自体は避けられない。しかし、その中身を`renderToStaticMarkup`で文字列化し`innerHTML`へ代入する方法は、Reactの管理下から外れたDOM操作であり避けること。代わりに`react-dom/client`の`createRoot`でコンテナへレンダリングし、Reactの管理下に置く。`createRoot().render()`は非同期にコミットされうるため、呼び出し側（ライブラリ側API）へ渡す時点で描画済みであることを保証する必要がある場合は`flushSync`で同期化すること。また、作成したrootは要素を破棄するタイミングで必ず`root.unmount()`を呼ぶこと（呼ばないとメモリリークする）。
