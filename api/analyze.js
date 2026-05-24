export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageBase64, mediaType, gender, relationship, situation } = req.body;
  if (!imageBase64) return res.status(400).json({ error: '画像がありません' });

  const genderText = gender === 'female' ? '女性' : '男性';

  const relationshipConfig = {
    friend: {
      role: '人間関係の専門家',
      focus: `友人（${genderText}）の感情状態・何を求めているかを読み取り、友情を深める自然な返信を3パターン提案してください。`,
    },
    crush: {
      role: '恋愛コーチ',
      focus: `付き合う前の相手（${genderText}）の脈あり・なしのサイン・好意の度合いを分析し、好印象を与えてより親密になれる返信を3パターン提案してください。`,
    },
    lover: {
      role: '恋愛心理の専門家',
      focus: `恋人（${genderText}）の気持ちの温度感・感情の変化を読み取り、関係をより深める返信を3パターン提案してください。`,
    },
    couple: {
      role: '夫婦関係カウンセラー',
      focus: `配偶者・パートナー（${genderText}）の本音・不満・気持ちを読み取り、夫婦関係を良好に保つ返信を3パターン提案してください。`,
    },
    family: {
      role: '家族関係カウンセラー',
      focus: `家族（${genderText}、子どもまたは両親）の気持ち・心配事を読み取り、家族関係を温かく保つ返信を3パターン提案してください。`,
    },
    customer_service: {
      role: '接客・サービス業のコミュニケーション専門家',
      focus: `お客様（${genderText}）の要望・不満・感情を正確に読み取り、丁寧でプロフェッショナルな返信を3パターン提案してください。`,
    },
    customer_other: {
      role: 'ビジネスコミュニケーションの専門家',
      focus: `取引先・顧客（${genderText}）の意図・要求・感情を読み取り、信頼関係を築くビジネス的な返信を3パターン提案してください。`,
    },
    other: {
      role: 'コミュニケーションの専門家',
      focus: `相手（${genderText}）の感情と意図を読み取り、状況に最適な返信を3パターン提案してください。`,
    }
  };

  const relNames = {
    friend: '友達',
    crush: '恋愛関係（付き合う前）',
    lover: '恋愛関係（恋人）',
    couple: '家族（夫婦）',
    family: '家族（子ども・両親）',
    customer_service: 'お客さん（接客業）',
    customer_other: 'お客さん（その他）',
    other: 'その他'
  };

  const rp = relationshipConfig[relationship] || relationshipConfig.other;
  const relName = relNames[relationship] || 'その他';

  const prompt = `あなたは${rp.role}です。添付されたLINEのスクリーンショットを分析してください。

【相手の性別】${genderText}
【相手との関係】${relName}
${situation ? `【補足情報】${situation}` : ''}

${rp.focus}

以下の形式でJSON形式のみで回答してください。他の文章は一切不要です。

{
  "urgency": 返信の重要度（0〜100の整数）,
  "urgencyLabel": "重要度のひと言ラベル（例：今すぐ返すべき）",
  "temp": 感情の温度（0〜100の整数）,
  "tempLabel": "感情のひと言ラベル（例：かなり好意的）",
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
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
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
