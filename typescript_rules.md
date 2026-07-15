# TypeScript Rules（TypeScript構文規約）

本ファイルは、rules.mdを分割した中でTypeScript言語レベルの構文規約をまとめたものです（Issue #47のレビュー対応。「rules.md」という抽象的な名前は、他の規約ファイルが具体的な名前を持つ中で不適切という指摘を受け、`typescript_rules.md`・[react_rules.md](./react_rules.md)・[comment_rules.md](./comment_rules.md)の3ファイルへ分割した）。実装時に常に参照する基礎的な規約です。

関連する他の規約ファイル:
- [react_rules.md](./react_rules.md): React/JSXコンポーネント固有の規約。
- [comment_rules.md](./comment_rules.md): TSDoc・コメントに関する規約。
- [design_principles.md](./design_principles.md): DRY/KISS/YAGNI・SOLID原則等の設計原則。モジュール分割やリファクタリングを判断する場面で参照する。
- [ui_rules.md](./ui_rules.md): Chakra UI・色/余白トークン等のスタイリング規約。フロントエンドのUIコンポーネントを実装・変更する場合のみ参照する。

機械的にチェックできる規約は、Biome（`pnpm run lint`）または専用スクリプト（`pnpm run check:type-assertions`・`pnpm run check:file-size`）に移行済みで、該当する規約は本ファイルでは詳細な例を省き参照先のみを示す。

# Biomeの自動チェックがカバーしない範囲について

本プロジェクトのBiome設定（`biome.json`）は、以下のルールの一部しか自動検出できない。

- **マジックナンバー**: Biomeの`noMagicNumbers`は比較・算術式に使われる数値リテラル（例: `if (count > 3)`）は検出するが、オブジェクトリテラルのプロパティ値（例: `{ width: 1200 }`）のような設定値としての数値リテラルは検出しない。
- **KISS（if-elseの簡略化等）**: 自動検出の対象外。単純な`if/else`を三項演算子にできる、ネストを減らせる等はBiomeの指摘に出ないため、コードレビュー時に人間・AIエージェントが個別に見直す必要がある（[design_principles.md](./design_principles.md)参照）。

**Biomeが指摘しないからといって、規約に準拠しているとは限らない。** 新規コード作成時・既存コードの見直し時は、Biomeのlint結果だけに頼らず、本ファイル・[react_rules.md](./react_rules.md)・[comment_rules.md](./comment_rules.md)・[design_principles.md](./design_principles.md)・[ui_rules.md](./ui_rules.md)の各ルールと照らし合わせて確認すること。

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
- `catch (error)`の`error`（型`unknown`）のように、ランタイムの検証と型の絞り込みを同時に行いたい場合、`function assertIsX(value: unknown): asserts value is X { ... }`という`asserts`型ガード関数を使うと、呼び出し側で`if (!(...)) { throw ... }`のような冗長な分岐を書かずに済む。特にテストコードで「`expect(value).toBeInstanceOf(X)`のアサーション自体が失敗時に例外を投げる」ことを利用し、`assertIsX`内でそのexpectを呼ぶだけの薄い関数にすると、テストの意図（Xのインスタンスであることを検証する）と型の絞り込みを1行で両立できる（例: `backend/src/test-utils/assert-is-app-exception.ts`のPR #56レビュー対応）。

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

# アロー関数を使用する

Biomeの`useArrowFunction`が自動検出する。

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
