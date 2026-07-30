# React Rules（React/JSX規約）

本ファイルは、rules.mdを分割した中でReact/JSXコンポーネント固有の規約をまとめたものです（Issue #47のレビュー対応）。TypeScript言語レベルの規約は[typescript_rules.md](./typescript_rules.md)、コメント規約は[comment_rules.md](./comment_rules.md)を参照してください。

---

# React Hooksは種類ごとにまとまる順番で書く

コンポーネント本体の先頭で呼び出すHooksは、以下の順番でグルーピングし、種類が変わるごとに1行あける。

1. `useContext`、`useAtom`
2. `useState`
3. `useRef`
4. カスタムフック
5. `useMemo`、`useCallback`
6. `useEffect`

同じ種類のHooks呼び出しが複数ある場合はグループ内でまとめる（間に別の種類を挟まない）。カスタムフック同士に依存関係がある場合（例: Aの戻り値をBの引数に渡す）は、その依存順を優先してよい（PR #69レビュー対応）。

このルールが対象とするのは上記6種類のHooks呼び出し同士の順序のみであり、Hooksではない通常の関数定義（イベントハンドラ等）の配置は対象外とする。ただし、あるカスタムフック呼び出しへ渡すコールバックを名前付きの変数として定義すると、その定義位置がHooks呼び出し群を分断してしまう場合がある。この場合、コールバックをフック呼び出しの直前に置く配置を安易に選ばず、まず以下の回避策を検討すること。

1. **インライン化**: コールバックの中身が1文程度であれば、`useCyclingActivities(visibility, () => onSyncComplete())`のように呼び出し箇所へ直接インライン化する。名前付き変数自体が不要になりHooks呼び出し列を分断しない。
2. **refトランポリン化**: 名前付きハンドラとして他のハンドラ群と一緒にまとめておきたい、かつ毎レンダーで参照が変わることがフック内部の依存配列上の問題になる場合は、`useCyclingActivities.ts`の`onSyncCompleteRef`のように最新の関数をrefへ格納し、フック内部からは`ref.current`経由で呼び出す。ハンドラ本体は他のハンドラ群と一緒に置ける。

これらの回避策がいずれも見合わない場合（例: コールバックが複数文からなりインライン化すると可読性を損なう上に、refトランポリンを導入するほどの必要性もない）に限り、コールバックをフック呼び出しの直前に置くことを許容する。この場合も「JavaScriptの変数束縛上そこに置く必要がある」という理由だけでは配置を正当化する根拠にはならず、上記回避策を先に検討し見合わなかったことが前提となる（PR #110レビュー対応。AIレビューとの2度の議論を経て、安易な例外化を避けるため回避策の検討を必須とする限定を追加した）。

# React Hooksの依存配列を無視しない

Biomeの`useExhaustiveDependencies`が自動検出する。依存配列を意図的に省略する場合は、[comment_rules.md](./comment_rules.md)の「biome-ignoreを使用する場合は理由を明記する」に従うこと。

# boolean型の属性値は省略する

NG
```typescript
<Component personal={true} />
```

OK
```typescript
<Component personal />
```

本ルールは`pnpm run check:boolean-jsx-props`（`scripts/check-boolean-jsx-props.mjs`）で機械的に検出できる（PR #55レビュー対応で追加）。現時点ではコミット時の自動実行には組み込んでおらず、手動実行のみ。

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

# Reactコンポーネントは自己閉じタグを使用する

Biomeの`useSelfClosingElements`が自動検出する。

---

# 複数の子孫が同じ状態を必要とする場合、状態取得フックは共通の親で呼ぶ

ある状態取得用フック（APIポーリング等の副作用を持つもの）の戻り値を、直接の子1つだけでなく、その子とは別の子孫（兄弟コンポーネント等）も必要とする場合、フックは片方の子孫の中へ押し下げず、両者に共通する親コンポーネントで呼び、propsで配る。

判断基準: 「フックの戻り値を渡すだけに見える中間コンポーネントがある」ことは、必ずしもそのフックをより深い階層へ移すべきというシグナルではない。まず、その戻り値を実際に使っている箇所が本当にその中間コンポーネント配下だけかを確認すること。他に使用箇所があるならフックを押し下げると、(1) その箇所へ戻り値を返すためのコールバックが新たに必要になり「渡すだけ」の構造が形を変えて残る、(2) 各所で同じフックを個別に呼ぶことになりポーリング等の副作用が重複する、のいずれかが発生する。

例: `MapWorkspace`が`useBackfillStatus`を呼ぶのは、`SettingsDialog`（`MapControls`経由）だけでなく、`MapControls`の外に独立して配置される`BackfillProgressFooter`（`useBackfillProgressFooter`経由）も同じ`backfillStatus`を必要とするため（PR #69レビュー対応、Issue #53）。

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

---

# グローバルステート（Jotai atom）の生の値・setterを外部へ公開しない

NG
```typescript
// errorsAtom.ts
export const errorsAtom = atom<AppErrorInfo[]>([]);

// 呼び出し側はuseSetAtom(errorsAtom)で任意の配列を直接セットできてしまう
```

OK
```typescript
// errorsAtom.ts
const errorsStateAtom = atom<AppErrorInfo[]>([]);

// 読み取り専用（useAtomValueのみ可能。useSetAtomで書き込もうとするとコンパイルエラーになる）
export const errorsAtom = atom((get) => get(errorsStateAtom));

// 書き込み専用。用途を限定した操作のみを公開する
export const addErrorAtom = atom(null, (get, set, error: AppErrorInfo) => {
  set(errorsStateAtom, [...get(errorsStateAtom), error]);
});
export const dismissErrorAtom = atom(null, (get, set, index: number) => {
  set(errorsStateAtom, get(errorsStateAtom).filter((_, i) => i !== index));
});
```

atomが持つ生の状態と、その状態を直接書き換えられるsetterをそのままexportすると、呼び出し側がどこからでも任意の値へ書き換えられてしまい、状態がどう変化しうるかをatomの定義だけから把握できなくなる（DIP/ISPで避けている「使わない操作への依存を強制する」ことと同種の問題）。書き込み用のatomは、実際に必要な操作（追加・削除等）ごとに用途を限定した形（`addErrorAtom`/`dismissErrorAtom`のように、対象の値・エラー内容など操作に必要な引数のみを受け取る）でexportし、読み取り用のatomは読み取り専用（`atom((get) => ...)`）にすること。カスタムフック（例: `useErrorReporter`）を経由するだけの薄いラッパーが不要になる場合は、atomを直接使う形に置き換えて削除してよい（`errorsAtom.ts`、PR #40レビュー対応、Issue #28）。

---

# 非同期処理の完了待ち中は、それを再度トリガーしうる操作を無効化する

NG
```typescript
// 待機中(isApplying)でも「実行」ボタンは常にクリック可能
<Button onClick={handleApply} size="sm">
  実行
</Button>
```

OK
```typescript
// 待機中は「実行」ボタンを無効化し、多重実行を防ぐ
<Button onClick={handleApply} size="sm" disabled={isApplying}>
  実行
</Button>
```

ある操作（ボタン等）が非同期処理を開始し、その完了を待つ状態（`isApplying`のような単一のフラグ、または複数の非同期処理の完了状況をまとめたオブジェクト等）を保持している場合、その状態が「完了待ち」である間は、同じ操作を再度トリガーできる入力（ボタン等）を無効化すること。無効化しないと、待機中に同じ操作をもう一度実行してしまい、1回目の完了待ち状態を2回目の呼び出しが（意図せず）上書きしてしまう可能性がある。特に、待機状態を「今回の呼び出しで新たに完了を待つべきものは何か」という形でその場（イベントハンドラ内）で都度算出し`setState`で丸ごと置き換えている場合は、2回目の呼び出しが1回目の分を完全に消し去ってしまうため注意が必要（`LayerDialog`の「実行」ボタン、PR #110レビュー対応、Issue #65）。
