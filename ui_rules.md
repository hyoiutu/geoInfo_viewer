# UI Rules（UI/スタイリング規約）

本ファイルは、コード規約から分割したChakra UI・スタイリングに関する規約をまとめたものです（Issue #47）。フロントエンドのUIコンポーネントを実装・変更する場合にのみ参照すればよく、バックエンドやロジックのみの変更では参照不要（コンテキスト削減のための分割）。

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

独自CSSクラスと`style.css`のような全体共有スタイルシートは、スタイルの影響範囲がコンポーネント外に漏れ出し、命名衝突や「このクラスがどこで使われているか」の追跡を難しくする。Chakra UIの`Box`/`Flex`等のstyle propsを使い、スタイルの責務をコンポーネント自身に閉じ込める。モーダルやダイアログ等、アクセシビリティ（フォーカストラップ、Escapeキー対応等）を含む複雑な挙動はChakraが提供するコンポーネント（`Dialog`等）を使い、自前で実装しない（車輪の再発明を避ける。詳細は[design_principles.md](./design_principles.md)参照）。

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

**MapLibreのpaintプロパティ等、Chakraのトークン機構を経由できないcanvas描画色は例外**とし、定数ファイルへ直接カラーコードを定義してよい（`frontend/src/constants/bicycleLog.ts`の`BICYCLE_LOG_LINE_COLOR_*`等）。MapLibreの`line-color`等のpaintプロパティはCSSカスタムプロパティを解釈できない（Canvas描画のため）ため。

**`maplibregl.Marker`用に独立したReact rootへマウントされ`ChakraProvider`配下に含まれないコンポーネント（`startGoalMarkerElement.ts`・`photoBalloonElement.ts`が使う`createRoot`パターン）も同様に例外だが、「トークン管理しなくてよい」という意味ではない。** これらのコンポーネントでもコンポーネントファイルへ生のカラーコード・CSSカスタムプロパティ参照を直接書かず、`constants/`配下（例: `constants/startGoalMarkers.ts`の`START_MARKER_ICON_COLOR`）へ`var(--chakra-colors-*)`形式の名前付き定数として切り出し、ui_rules.mdの規約対象外である理由をコメントで明記すること。Chakraのテーマ値をハードコードで複製したフォールバック値（例: `var(--chakra-colors-blue-500, #3182ce)`）も追加しないこと（テーマ変更時にフォールバック値だけ取り残される）。この切り出しを怠ると、同じ非Chakraコンポーネントであっても色だけがコンポーネントファイルへ直書きされ、他の値（サイズ等）は定数化されているのに一貫性が崩れる（PR #117レビュー対応、`PhotoBalloonClusterBadge`で発生）。

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

# Chakra UIの複合コンポーネントでdisabled等の状態propsを渡す先はRoot/Field双方の型定義で確認する

NG
```tsx
// NativeSelect.Fieldに直接disabledを渡そうとすると型エラーになる
// (NativeSelectFieldPropsにdisabledが存在しない)
<NativeSelect.Root size="sm">
  <NativeSelect.Field aria-label="行政区画の年代" disabled={isApplyingLayerSettings}>
    ...
  </NativeSelect.Field>
</NativeSelect.Root>
```

OK
```tsx
// Rootへdisabledを渡すと、内部のcontext経由でFieldへ伝播する
<NativeSelect.Root size="sm" disabled={isApplyingLayerSettings}>
  <NativeSelect.Field aria-label="行政区画の年代">
    ...
  </NativeSelect.Field>
</NativeSelect.Root>
```

`NativeSelect`・`Checkbox`等、Chakra UIの`Root`/`Field`/`Control`のようなサブコンポーネントに分かれた複合コンポーネントは、`disabled`のような状態propsを**必ずしも末端のサブコンポーネント（例: `Field`）が受け取るとは限らない**。`NativeSelect`の場合、`disabled`は`Root`が受け取り、内部のcontext（`NativeSelectBasePropsProvider`）経由で`Field`へ伝播する設計になっており、`Field`側の型定義（`NativeSelectFieldProps`）には`disabled`が存在しない。想定通りに動かない・型エラーになる場合は、`node_modules`内の実装（`.d.ts`だけでなく実際のソース）を確認し、状態を実際に受け取っているサブコンポーネントを特定してから渡すこと（`LayerDialog.tsx`の`AdminBoundaryEraSelect`、PR #110レビュー対応）。
