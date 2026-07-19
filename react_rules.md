# React Rules（React/JSX規約）

本ファイルは、rules.mdを分割した中でReact/JSXコンポーネント固有の規約をまとめたものです（Issue #47のレビュー対応）。TypeScript言語レベルの規約は[typescript_rules.md](./typescript_rules.md)、コメント規約は[comment_rules.md](./comment_rules.md)を参照してください。

---

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
