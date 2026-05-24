export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageBase64, mediaType, gender, relationship, situation, chatHistory, choiceHistory } = req.body;
  if (!imageBase64) return res.status(400).json({ error: '画像がありません' });

  const normalizedType = (mediaType || 'image/jpeg')
    .replace('image/jfif', 'image/jpeg')
    .replace('image/jpg', 'image/jpeg');
  const safeMediaType = ['image/jpeg','image/png','image/gif','image/webp'].includes(normalizedType)
    ? normalizedType : 'image/jpeg';

  const genderText = gender === 'female' ? '女性' : '男性';

  const configs = {
    friend:         { role: '人間関係の専門家',                                    focus: `友人（${genderText}）の感情状態・何を求めているかを読み取り、友情を深める自然な返信を3パターン提案してください。` },
    crush:          { role: '恋愛コーチ',                                          focus: `付き合う前の相手（${genderText}）の脈あり・なしのサインを分析し、好印象を与えてより親密になれる返信を3パターン提案してください。` },
    lover:          { role: '恋愛心理の専門家',                                    focus: `恋人（${genderText}）の気持ちの温度感・感情の変化を読み取り、関係をより深める返信を3パターン提案してください。` },
    couple:         { role: '夫婦関係カウンセラー',                                focus: `配偶者（${genderText}）の本音・不満・気持ちを読み取り、夫婦関係を良好に保つ返信を3パターン提案してください。` },
    family:         { role: '家族関係カウンセラー',                                focus: `家族（${genderText}）の気持ち・心配事を読み取り、家族関係を温かく保つ返信を3パターン提案してください。` },
    night_customer: { role: '夜職・ホスト・キャバクラ業界のコミュニケーション専門家', focus: `お客様（${genderText}）の本音・感情・お店への関心度を読み取り、来店意欲を高めて関係を深めるLINE返信を3パターン提案してください。営業感を出しすぎず自然に距離を縮めることを意識してください。` },
    night_staff:    { role: '夜職・ホスト・キャバクラ業界のコミュニケーション専門家', focus: `お店の子（${genderText}）の感情・本音・状況を読み取り、良好な関係を築くための自然な返信を3パターン提案してください。` },
    other:          { role: 'コミュニケーションの専門家',                          focus: `相手（${genderText}）の感情と意図を読み取り、状況に最適な返信を3パターン提案してください。` }
  };

  const relNames = {
    friend: '友達', crush: '恋愛関係（付き合う前）', lover: '恋愛関係（恋人）',
    couple: '家族（夫婦）', family: '家族（子ども・両親）',
    night_customer: 'お客様（飲食店）', night_staff: '飲み友達', other: 'その他'
  };

  const rp = configs[relationship] || configs.other;
  const relName = relNames[relationship] || 'その他';
  const historySection = chatHistory ? `\n【過去のトーク履歴（参考）】\n${chatHistory.slice(0, 3000)}\n` : '';
  const choiceSection = choiceHistory ? `\n【過去の返信選択履歴】\n${choiceHistory}\n※この傾向を踏まえて返信案を提案してください。\n` : '';

  const prompt = `あなたは${rp.role}です。添付されたLINEのスクリーンショットを分析してください。

【相手の性別】${genderText}
【相手との関係】${relName}
${situation ? `【補足情報】${situation}` : ''}${historySection}${choiceSection}

${rp.focus}
${chatHistory ? '過去のトーク履歴も参考にして、相手の性格・口調・関係性の深さも踏まえた分析と返信を提案してください。' : ''}

以下の形式でJSON形式のみで回答してください。他の文章は一切不要です。

{
  "urgency": 返信の重要度（0〜100の整数）,
  "urgencyLabel": "重要度のひと言ラベル",
  "temp": 感情の温度（0〜100の整数）,
  "tempLabel": "感情のひと言ラベル",
  "feeling": "相手の感情・状況の分析（2〜3文、無料公開部分）",
  "feelingDetail": "より深い心理・背景の分析（3〜4文、有料部分）",
  "reply1": "返信案1のタイトル｜返信文本体",
  "reply2": "返信案2のタイトル｜返信文本体",
  "reply3": "返信案3のタイトル｜返信文本体",
  "warning": "注意すべきポイント・NGな返し方（有料部分）",
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
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: safeMediaType, data: imageBase64 } },
          { type: 'text', text: prompt }
        ]}]
      })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const raw = data.content.map(b => b.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    res.status(200).json(JSON.parse(clean));
  } catch (e) {
    res.status(500).json({ error: '解析に失敗しました: ' + e.message });
  }
}

