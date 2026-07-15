# Design Principles（設計原則）

本ファイルは、コード規約から分割した設計原則（DRY/KISS/YAGNI・SOLID原則等）をまとめたものです（Issue #47）。コードの構造・責務分割に関する原則であり、個々の構文レベルの規約（[typescript_rules.md](./typescript_rules.md)・[react_rules.md](./react_rules.md)・[comment_rules.md](./comment_rules.md)）よりも参照頻度は低いものの、モジュール分割・リファクタリングを判断する場面では必ず参照すること。Biomeでは機械的に検出できない領域です。

`pnpm run check:file-size`（`scripts/check-file-size.mjs`）は、1ファイルの行数・JSXのネスト深さが一定の閾値を超えたファイルを検出する。責務が集まりすぎている兆候として、該当ファイルは本ファイルの原則（特にSRP）に照らして再確認すること。

**JSXネスト深さの超過は、兄弟コンポーネントとの共通ラッパー抽出で解消できることがある**: 複数のコンポーネントが同じUIライブラリの決まったラッパー構造（例: Chakra UIの`Dialog.Root`/`Backdrop`/`Positioner`/`Content`）を個別に持っている場合、その構造自体を1つの共通コンポーネント（例: `AppDialog`）として切り出すと、各コンポーネント側のJSXネストが1階層に集約され、DRY違反の解消と`check:file-size`の閾値超過解消を同時に達成できる（PR #55レビュー対応、`LayerDialog`等4つのDialogコンポーネントを`AppDialog`へ集約した実例）。

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

2箇所の実装が似ているものの、呼び出し元での用途（例: 表示用に文字列へ整形する／比較のため生の数値のまま使う）が異なる場合、「責務が違うから共通化しない」と判断したくなることがある。しかし**戻り値の型・後続の加工が分かれる手前まで、計算ロジック自体が完全に同一なら共通化の対象とする**こと。用途の違いは呼び出し元でその戻り値をどう加工するかの違いであり、計算ロジックが重複してよい理由にはならない（例: 「走行距離÷走行時間」という平均時速の算出式を、表示用フォーマット関数とフィルタ用関数の両方に独立して実装していたが、算出結果(number)を返すところまでが同一だったため、共通関数として切り出した）。

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
// biome-ignore lint/suspicious/noExplicitAny: TODO: 後で any と警告を修正する
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

## SRPの実例: コンポーネントファイルには表示に関する関数・TSXのみを置く

NG

```typescript
// MapView.tsx
const findActivityById = (activities: CyclingActivity[], id: string | null): CyclingActivity | null => {
  if (id === null) {
    return null;
  }
  return activities.find((activity) => activity.id === id) ?? null;
};

export const MapView = (props: MapViewProps) => {
  // findActivityByIdを使って描画する
};
```

OK

```typescript
// utils/findActivityById.ts
export const findActivityById = (activities: CyclingActivity[], id: string | null): CyclingActivity | null => {
  if (id === null) {
    return null;
  }
  return activities.find((activity) => activity.id === id) ?? null;
};

// MapView.tsx
import { findActivityById } from '../utils/findActivityById';

export const MapView = (props: MapViewProps) => {
  // findActivityByIdを使って描画する
};
```

コンポーネントファイル（`components/`配下）には、表示（JSX）や地図ライブラリ操作等の画面に直接関わる処理のみを置く。データの検索・変換等、画面表示に依存しない純粋関数はコンポーネントファイル内に定義せず`utils/`へ切り出すこと。切り出すことで、DOMや外部ライブラリのモック無しに単体テストできるようになり、コンポーネントファイル自体の見通しも良くなる（PR #36レビュー対応）。

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
