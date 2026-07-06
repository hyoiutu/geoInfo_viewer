# Biomeの自動チェックがカバーしない範囲について

本プロジェクトのBiome設定（`biome.json`）は、以下のルールの一部しか自動検出できない。

- **マジックナンバー**: Biomeの`noMagicNumbers`は比較・算術式に使われる数値リテラル（例: `if (count > 3)`）は検出するが、オブジェクトリテラルのプロパティ値（例: `{ width: 1200 }`）のような設定値としての数値リテラルは検出しない。
- **KISS（if-elseの簡略化等）**: 自動検出の対象外。単純な`if/else`を三項演算子にできる、ネストを減らせる等はBiomeの指摘に出ないため、コードレビュー時に人間・AIエージェントが個別に見直す必要がある。

**Biomeが指摘しないからといって、規約に準拠しているとは限らない。** 新規コード作成時・既存コードの見直し時は、Biomeのlint結果だけに頼らず、本ファイルの各ルールと照らし合わせて確認すること。

---

# 使用しない引数は_(アンダースコア)にする

NG
```typescript
const func = (event, args) => {
  console.log(args);
}
```

OK
```typescript
const func = (_, args) => {
  console.log(args);
}
```

# テストケースは日本語で書く

NG
```typescript
describe('API test', () => {
  test('if the API is called, status code is 200.', () => {
    ...
  })
})
```

OK
```typescript
describe('APIに関するテスト', () => {
  test('APIが呼ばれたとき、ステータスコードは200を返す', () => {
    ...
  })
})
```

# TypeScriptの使用

NG
JavaScriptファイル(.js, .jsx)を使用する。

OK
TypeScriptファイル(.ts, .tsx)を使用し、適切な型定義を行う。

# React Hooksの依存配列を無視しない

NG
```typescript
useEffect(() => {
  // ...
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

OK
```typescript
useEffect(() => {
  // ...
}, [state]);
```

# eslint-disableを使用する場合は理由を明記する

NG
```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
```

OK
```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps -- state更新時の再実行を防ぐため
```

# anyやas（型キャスト）は原則使用しない

NG
```typescript
const data: any = fetchedData;
const user = {} as User;
```

OK
```typescript
const data: User = fetchedData;
const user: User = { id: 1, name: "name" };
```

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

NG
```typescript
interface User {
  id: number;
  name: string;
}
```

OK
```typescript
type User = {
  id: number;
  name: string;
};
```

# 三項演算子はネストしない

NG
```typescript
const result = x > 0 ? (x % 2 === 0 ? "Even" : "Odd") : "Negative";
```

OK
```typescript
let result;
if (x > 0) {
  result = x % 2 === 0 ? "Even" : "Odd";
} else {
  result = "Negative";
}
```

# 命名規則の遵守

NG
```typescript
const SomeVar = 10;
const cntList = [1, 2, 3];
```

OK
```typescript
const someVar = 10;
const counts = [1, 2, 3];
```

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

NG
```typescript
const name: string = "foo";
const [count, setCount] = useState<number>(0);
```

OK
```typescript
const name = "foo";
const [count, setCount] = useState(0);
```

# マジックナンバーを使用しない

NG

```typescript
if (retryCount > 3) {
  // ...
}
```

OK

```typescript
const MAX_RETRY_COUNT = 3;

if (retryCount > MAX_RETRY_COUNT) {
  // ...
}
```

---

# importは自動ソートする

NG

```typescript
import z from './z';
import a from './a';
import React from 'react';
```

OK

```typescript
import React from 'react';

import a from './a';
import z from './z';
```

---

# exportはdefault exportではなくnamed exportを使用する

NG

```typescript
export default function Button() {
  return <button>OK</button>;
}
```

OK

```typescript
export const Button = () => {
  return <button>OK</button>;
};
```

---

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

---

# Reactコンポーネントは自己閉じタグを使用する

NG

```tsx
<Loading></Loading>
```

OK

```tsx
<Loading />
```

---

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

---

# アロー関数を使用する

NG

```typescript
function add(a: number, b: number) {
  return a + b;
}
```

OK

```typescript
const add = (a: number, b: number) => {
  return a + b;
};
```

---

# 未使用の変数は残さない

NG

```typescript
const result = fetchData();
const unused = 0;

return result;
```

OK

```typescript
const result = fetchData();

return result;
```

---

# default exportは禁止する

NG

```typescript
export default App;
```

OK

```typescript
export const App = () => {
  // ...
};
```

---

# import文はソートする

NG

```typescript
import z from "./z";
import React from "react";
import a from "./a";
```

OK

```typescript
import React from "react";

import a from "./a";
import z from "./z";
```

---

# マジックナンバーは定数化する

NG

```typescript
if (count > 10) {
  // ...
}
```

OK

```typescript
const MAX_COUNT = 10;

if (count > MAX_COUNT) {
  // ...
}
```

---

# 文字列のマジックナンバー（マジックストリング）も定数化する

比較や分岐に使う文字列リテラルも、数値のマジックナンバーと同様に定数化する。ただしUnion型で表現され型チェッカーが誤り（typo）を検出できる値（例: `'video' | 'image'`のような限定されたリテラル型同士の比較）は対象外とする。

NG

```typescript
if (file.dateSource === 'metadata') {
  // ...
}
```

OK

```typescript
const DATE_SOURCE_METADATA = 'metadata';

if (file.dateSource === DATE_SOURCE_METADATA) {
  // ...
}
```

---

# DRY（Don't Repeat Yourself）: 重複を避ける

NG

```typescript
const user1Greeting = "Hello, Alice!";
const user2Greeting = "Hello, Bob!";
```

OK

```typescript
const greetUser = (name: string) => `Hello, ${name}!`;
const user1Greeting = greetUser("Alice");
const user2Greeting = greetUser("Bob");
```

---

# KISS（Keep It Simple, Stupid）: シンプルに保つ

NG

```typescript
const calculateArea = (shape: 'rectangle' | 'circle', dimensions: number[]) => {
  if (shape === 'rectangle') {
    return dimensions[0] * dimensions[1];
  } else if (shape === 'circle') {
    return Math.PI * (dimensions[0] ** 2);
  }
};
```

OK

```typescript
const calculateRectangleArea = (width: number, height: number) => width * height;
const calculateCircleArea = (radius: number) => Math.PI * (radius ** 2);
```

---

# YAGNI（You Aren't Gonna Need It）: 今必要なことだけやる

NG

```typescript
type User = {
  name: string;
  role: 'admin' | 'user';
  permissions: string[];
};

const createUser = (name: string, role: 'admin' | 'user'): User => {
  // 将来使うかもしれないと見越して権限分岐をあらかじめ実装するが、実際には現状全員同じ権限
  const permissions = role === 'admin' ? ['read', 'write', 'delete'] : ['read'];
  return { name, role, permissions };
};
```

OK

```typescript
type User = {
  name: string;
  permissions: string[];
};

const createUser = (name: string): User => {
  return { name, permissions: ['read', 'write'] };
};
```

---

# 車輪の再発明を避ける: 既存ライブラリやAPIを優先する

NG

```typescript
// 自作のパス結合ユーティリティ
const joinPaths = (dir: string, file: string) => {
  return dir.endsWith('/') ? `${dir}${file}` : `${dir}/${file}`;
};
```

OK

```typescript
import path from 'node:path';

const filePath = path.join(dir, file);
```

---

# 割れ窓の法則を避ける: 小さな問題（エラーや警告）を放置しない

NG

```typescript
// eslint-disable-next-line -- TODO: 後で any と警告を修正する
const data: any = fetchedData;
```

OK

```typescript
const data: UserInfo = fetchedData;
```

---

# 名前重要: 意図の伝わる適切な命名を行う

NG

```typescript
const c = 10;
const calculateTotalAmountOfAllScannedFilesIncludingTaxes = (files: any[]) => {
  // ...
};
```

OK

```typescript
const fileCount = 10;
const calculateTotalSize = (files: FileInfo[]) => {
  // ...
};
```

---

# SRP（単一責任の原則）: モジュールを変更する理由は1つにする

NG

```typescript
const TodoList = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetch('/api/todos')
      .then((res) => res.json())
      .then(setTodos)
      .finally(() => setIsFetching(false));
  }, []);

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
};
```

OK

```typescript
const useFetchTodos = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetch('/api/todos')
      .then((res) => res.json())
      .then(setTodos)
      .finally(() => setIsFetching(false));
  }, []);

  return { todos, isFetching };
};

const TodoList = () => {
  const { todos } = useFetchTodos();

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
};
```

データ取得（フェッチ）と描画（表示）という2つの責任が1つのコンポーネントに混在すると、どちらかの都合で変更するたびにもう一方まで壊れるリスクが生まれる。カスタムhooksに分離することで、コンポーネントは「描画」だけに責任を持てる。

---

# OCP（オープン・クローズドの原則）: 拡張に対して開き、修正に対して閉じる

NG

```typescript
type TitleProps = {
  title: string;
  variant: 'default' | 'withLinkButton';
  href?: string;
};

const Title = ({ title, variant, href }: TitleProps) => {
  return (
    <div>
      <h1>{title}</h1>
      {variant === 'withLinkButton' && <a href={href}>詳細</a>}
    </div>
  );
};
```

OK

```typescript
const Title = ({ title, children }: { title: string; children?: ReactNode }) => {
  return (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  );
};

const TitleWithLink = ({ title, href }: { title: string; href: string }) => (
  <Title title={title}>
    <a href={href}>詳細</a>
  </Title>
);
```

NG例では新しいバリエーションを追加するたびに`Title`本体を修正し`variant`の分岐を増やす必要がある。OK例ではComposition（`children`によるコンポーネント合成）で拡張し、`Title`自体には変更を加えない。

---

# LSP（リスコフの置換原則）: 期待される契約を満たす実装だけを渡す

NG

```typescript
type FileStorage = {
  save: (path: string, data: string) => void;
};

const createReadOnlyStorage = (): FileStorage => ({
  save: () => {
    throw new Error('read-only storageではsaveはサポートされません');
  }
});
```

OK

```typescript
type ReadableStorage = {
  load: (path: string) => string;
};

type WritableStorage = ReadableStorage & {
  save: (path: string, data: string) => void;
};

const createReadOnlyStorage = (): ReadableStorage => ({
  load: (path) => fs.readFileSync(path, 'utf8')
});
```

NG例は`FileStorage`型を満たすと期待して呼び出した側が`save()`を呼ぶと必ず例外になり、契約に違反する。OK例は「読み取り専用」と「書き込み可能」を型で分離し、`ReadableStorage`を期待する呼び出し側はどんな実装を渡されても契約通りに動作する。

---

# ISP（インターフェース分離の原則）: 使わないプロパティへの依存を強制しない

NG

```typescript
type Post = {
  title: string;
  author: { name: string; age: number };
  createdAt: Date;
};

const PostTitle = ({ post }: { post: Post }) => <h1>{post.title}</h1>;
const PostDate = ({ post }: { post: Post }) => <time>{post.createdAt.toISOString()}</time>;
```

OK

```typescript
const PostTitle = ({ title }: { title: string }) => <h1>{title}</h1>;
const PostDate = ({ date }: { date: Date }) => <time>{date.toISOString()}</time>;
```

NG例は`title`しか使わないコンポーネントが`author`や`createdAt`を含む`Post`全体に依存しており、無関係な変更の影響を受けやすい。OK例は必要なプロパティのみを受け取ることで依存範囲を最小化する。

---

# DIP（依存性逆転の原則）: 抽象に依存し、具象ライブラリに直接依存しない

NG

```typescript
import useSWR from 'swr';

const useTodos = () => {
  const { data } = useSWR<Todo[]>('/api/todos', fetcher);
  return data;
};
```

OK

```typescript
type FetchResult<T> = {
  data: T | undefined;
  isLoading: boolean;
};

const useFetch = <T,>(key: string, fetcher: () => Promise<T>): FetchResult<T> => {
  const { data, isValidating } = useSWR<T>(key, fetcher);
  return { data, isLoading: isValidating };
};

const useTodos = () => useFetch<Todo[]>('/api/todos', fetchTodos);
```

NG例はコンポーネント側が`swr`という具体的なライブラリに直接依存しており、ライブラリを差し替えると呼び出し側すべてに影響する。OK例は`useFetch`という抽象インターフェースの裏に具象実装を隠すことで、将来ライブラリを差し替えてもコンポーネント側の変更が不要になる。

参考: https://zenn.dev/koki_tech/articles/361bb8f2278764

---

# UIはChakra UIコンポーネントを優先し、独自CSSクラスを新規作成しない

NG
```tsx
// style.css側
.drop-zone {
  border: 2px dashed #333;
  border-radius: 14px;
  padding: 24px 16px;
}

// コンポーネント側
<div className="drop-zone">...</div>
```

OK
```tsx
import { Box } from '@chakra-ui/react';

<Box border="2px dashed" borderColor="borderDefault" borderRadius="14px" padding="24px 16px">
  ...
</Box>
```

独自CSSクラスと`style.css`のような全体共有スタイルシートは、スタイルの影響範囲がコンポーネント外に漏れ出し、命名衝突や「このクラスがどこで使われているか」の追跡を難しくする。Chakra UIの`Box`/`Flex`等のstyle propsを使い、スタイルの責務をコンポーネント自身に閉じ込める。モーダルやダイアログ等、アクセシビリティ（フォーカストラップ、Escapeキー対応等）を含む複雑な挙動はChakraが提供するコンポーネント（`Dialog`等）を使い、自前で実装しない（車輪の再発明を避ける）。

---

# style propsが多くなりすぎる場合は専用コンポーネントかtheme recipeに切り出す

NG
```tsx
// 同じ組み合わせのstyle propsをボタンを使う場所ごとに書き続ける
<Button bg="linear-gradient(135deg, #8a2be2, #4a00e0)" color="#fff" boxShadow="0 4px 15px rgba(138, 43, 226, 0.3)" _hover={{ transform: 'translateY(-1px)' }}>
  コピーを開始する
</Button>
```

OK
```tsx
// CopyActions.tsx: このスタイルの組み合わせを使う専用コンポーネントに閉じ込める
const PrimaryActionButton = (props: ButtonProps) => (
  <Button bg={gradients.primary} color="#fff" boxShadow="0 4px 15px rgba(138, 43, 226, 0.3)" _hover={{ transform: 'translateY(-1px)' }} {...props} />
);
```

同一の見た目が2箇所以上で使われる場合、または1要素に付与するstyle propsが5個を超える場合は、専用コンポーネント（同一ファイル内に閉じたprivateコンポーネントでもよい）かChakraのtheme recipeに切り出す。呼び出し側でstyle propsを毎回書き直すと、見た目を変更する際の修正漏れや、そもそも何のためのpropsか読み取りにくくなる問題が起きる。

---

# 色は生のカラーコードではなく意味を持たせた名前のトークンとして管理する

NG
```tsx
<Box bg="rgba(30, 30, 45, 0.6)" color="#f0f0f5">
  ...
</Box>
```

OK
```tsx
// src/theme.ts側でトークンとして定義する
colors: {
  bgSurface: { value: 'rgba(30, 30, 45, 0.6)' },
  textMain: { value: '#f0f0f5' }
}

// コンポーネント側はトークン名を参照する
<Box bg="bgSurface" color="textMain">
  ...
</Box>
```

生のカラーコード（`#8a2be2`や`rgba(...)`）をコンポーネントに直接書くと、同じ色のつもりで微妙に異なる値が紛れ込んだり、色を変更する際に修正漏れが起きる。`src/theme.ts`の`colors`トークンとして一元管理し、コンポーネントからは必ずトークン名で参照する。

**新しい色を安易に増やさない**: 色を追加する前に、既存のトークンで役割を表現できないか必ず検討する。目安として以下のように「役割」ごとに色を用意し、同じ役割の色が複数の微妙に異なる値に分裂しないようにする。
- メイン（ブランド・アクション）: `brandPrimary` / `brandPrimaryHover` / `brandPrimaryMuted`
- サブ（補助的な強調）: 用途ごとに`*Accent`のようなトークンを用意する
- エラー・キャンセル: `danger`
- テキスト: `textMain` / `textMuted` / `textInverse`
- 背景・ボーダー・オーバーレイ: `bg*` / `border*` / `overlay*` / `scrim*`（いずれも「弱・中・強」等の少数の段階に収める）

---

# 余白・サイズはChakraのデザイントークンを最優先し、無い場合は4pxルールで定数化する

NG
```tsx
<Box padding="17px" gap="10px" borderRadius="14px">
  ...
</Box>
```

OK
```tsx
// 1. 最優先: Chakraが提供する標準スケール（4の倍数を基本としたspacing/sizes/radii等のトークン）をそのまま使う
<Box padding="4" gap="2.5" borderRadius="xl">
  ...
</Box>

// 2. Chakraの標準スケールに一致する値が無い場合は、4pxの倍数に丸めた上でsrc/theme.tsに定数化する
// src/theme.ts
export const layout = {
  sidebarWidth: '340px' // 4pxの倍数。Chakraのsizesトークンには一致する値が無いため定数化する
};
```

余白・サイズにその場限りの数値（マジックナンバー）を使うと、値の一貫性が失われ「なぜその数値なのか」が分からなくなる。**最優先でChakraが提供するデザイントークン**（`padding="4"`のような数値スケール、`fontSize="sm"`、`borderRadius="xl"`等）を使うこと。Chakraのトークンに一致する値が存在しない場合に限り、4pxの倍数に丸めた値を`src/theme.ts`に定数化して使う。既存デザインの寸法が4の倍数でない場合、4の倍数に丸めることによる見た目の変化は許容する（`specs/system_specification.md`のUI/UXコンセプトから逸脱しない範囲であればよい）。

---

# 複数コンポーネントで使う色・余白・サイズのパターンはグローバルなファイルにまとめる

NG
```tsx
// FileCard.tsxとProgressPanel.tsxのそれぞれで同じ色を別々に書く
// FileCard.tsx
<Box bg="rgba(0, 0, 0, 0.2)">...</Box>
// ProgressPanel.tsx
<Box bg="rgba(0, 0, 0, 0.2)">...</Box>
```

OK
```tsx
// src/theme.ts: 一箇所にまとめて定義する
colors: {
  scrimMedium: { value: 'rgba(0, 0, 0, 0.2)' }
}

// 各コンポーネントはトークン名で参照するだけにする
<Box bg="scrimMedium">...</Box>
```

色・フォントサイズ・余白サイズ等が複数のコンポーネントで共通して使われるようになってきたら、コンポーネントごとに同じ値を書き写すのではなく、`src/theme.ts`（Chakraのtheme tokens、または`gradients`/`shadows`/`layout`等のプレーンな定数export）に一元化し、各コンポーネントはそこから参照する。

---

# コミットメッセージにはプレフィックスを付与する

NG
```git
git commit -m "地図表示コンポーネントを追加"
```

OK
```git
git commit -m "feat: 地図表示コンポーネントを追加"
```

コミットする変更の性質に応じて、以下のプレフィックスを必ず付与すること：
- `feat:` (新機能やスキルの追加)
- `fix:` (バグ修正)
- `docs:` (ドキュメントや規約、コメントのみの修正)
- `style:` (コードの意味に影響しないフォーマットなどの修正)
- `refactor:` (機能追加やバグ修正を含まないリファクタリング)
- `test:` (テストの追加や修正)
- `chore:` (ビルド構成や雑多な設定の修正)

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
