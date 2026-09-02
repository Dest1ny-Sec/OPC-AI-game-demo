// app/src/views/AsylumView.jsx
// 保留 AsylumView 名字以避免破坏 import，转调 EndingPage（向后兼容）

import EndingPage from './EndingPage.jsx'

export default function AsylumView({ reason, onReset, onHome }) {
  return <EndingPage endingId="asylum" reason={reason} onReset={onReset} onHome={onHome} />
}
