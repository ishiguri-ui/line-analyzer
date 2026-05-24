export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageBase64, mediaType, situation } = req.body;
  if (!imageBase64) return res.status(400).json({ error: '画像がありません' });

  const prompt = `あなたは恋愛心理の専門家です。添付されたLINEのスクリーンショットを分析してください。

${situation ? `【補足情報】${situation}` : ''}

以下の形式でJSON形式のみで回答してください。他の文章は一切不要です。

{
  "score": 脈あり度（0〜100の整数）,
  "scoreLabel": "脈あり度のひと言ラベル（例：かなり脈あり）",
  "feeling": "相手の気持ちの分析（2〜3文、無料公開部分）",
  "feelingDetail": "より深い心理分析（3〜4文、有料部分）",
  "nextMessage": "次に送るべきメッセージの提案（有料部分）",
  "warning": "注意すべきポイント（有料部分）",
  "summary": "一言まとめ（無料公開部分、20文字以内）"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const raw = data.content.map(b => b.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: '解析に失敗しました: ' + e.message });
  }
}
