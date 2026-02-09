# JSON 模板与说明

## 1. 跨平台映射（cross-platform-mapping.json）

用途：严格匹配不同平台的同一事件，避免错误套利。

```json
{
  "entries": [
    {
      "label": "2026 NBA Finals Winner",
      "predictMarketId": "<Predict condition_id 或 event_id>",
      "predictQuestion": "<可选：问题文本，用于兜底匹配>",
      "polymarketYesTokenId": "<Polymarket YES tokenId>",
      "polymarketNoTokenId": "<Polymarket NO tokenId>",
      "opinionYesTokenId": "<Opinion YES tokenId>",
      "opinionNoTokenId": "<Opinion NO tokenId>"
    }
  ]
}
```

注意：
- 尽量填写 `predictMarketId`，优先精确匹配。
- 不同平台事件描述可能有差异，必须保证真实一致。

## 2. 依赖套利约束（dependency-constraints.json）

用途：描述多个市场之间的逻辑关系。

```json
{
  "version": 1,
  "notes": "2026 总统选举示例",
  "conditions": [
    {
      "id": "COND_A",
      "label": "候选人 A 当选",
      "yesTokenId": "<YES tokenId>",
      "noTokenId": "<NO tokenId>"
    },
    {
      "id": "COND_B",
      "label": "候选人 A 赢得摇摆州 X",
      "yesTokenId": "<YES tokenId>",
      "noTokenId": "<NO tokenId>"
    }
  ],
  "groups": [],
  "relations": [
    {
      "type": "implies",
      "if": "COND_B",
      "then": "COND_A"
    }
  ]
}
```

关系类型：
- `implies`: A 为真 ⇒ B 为真
- `mutual_exclusive`: A 与 B 不能同时为真
- `one_of`: 该组必须且只能一个为真
- `at_most`: 该组最多 k 个为真
- `at_least`: 该组至少 k 个为真
