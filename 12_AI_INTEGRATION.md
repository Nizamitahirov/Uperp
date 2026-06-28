# 12. AI İNTEQRASİYASI (GROQ) — TAM

> Groq AI bütün sistem boyu. Azərbaycanca + İngiliscə dəstək.

---

## 12.1 ÜMUMİ ARXİTEKTURA

```
Client (Next.js)
   ↓ (heç vaxt API key client-də deyil!)
Firebase Cloud Function (AI proxy)
   ↓
Groq API (LLM inference)
   ↓
Cavab → Client

Model: Llama 3.3 70B / Mixtral (Groq-da mövcud, sürətli)
Dil: system prompt-da AZ/EN təyin edilir
```

### Təhlükəsizlik
```
- Groq API key yalnız Cloud Function env-də (GROQ_API_KEY)
- Rate limiting (istifadəçi başına)
- Input validation
- Output sanitization
```

---

## 12.2 AI İSTİFADƏ HALLARI (Use Cases)

### 1. Xülasə Hazırlama (Summary)
```
- Aylıq satış/maliyyə xülasəsi
- Müştəri tarixçə xülasəsi
- İstehsal hesabat xülasəsi
- PO/sifariş xülasəsi
```

### 2. Sənəd/Mətn Tərtibi
```
- Invoice/faktura mətn
- PO email (supplier-ə)
- Müştəri email (xatırlatma, təklif)
- Təhvil-təslim aktı qeydləri
- Müqavilə şablonu draft
```

### 3. Məhsul Description
```
- Marketinq təsviri (AZ + EN)
- SEO meta
- Kolleksiya hekayəsi
- Feature bullet points
```

### 4. AI Chatbot (Sual-Cavab)
```
- İşçi köməkçisi: "Denim stoku nə qədərdir?"
- Müştəri köməkçisi: "Bu model hansı ölçülərdə var?"
- AZ və EN dilində
- Sistem datası ilə kontekst (RAG)
```

### 5. Analitika İnsights
```
- Trend təhlili
- Anomaliya aşkarlama
- Proqnoz şərhi
- Tövsiyələr
```

### 6. Digər AI imkanları (əlavə)
```
- Material tələb proqnozu köməyi
- Qiymət optimallaşdırma təklifi
- Müştəri seqmentasiya
- Defect səbəb analizi (pattern)
- Inventory optimization tövsiyə
```

---

## 12.3 AI CHATBOT (Detallı)

### İnterfeys
```
- Floating chat button (bütün səhifələrdə)
- Tam ekran chat (mobile)
- Dil seçimi (AZ/EN toggle)
- Səs girişi (opsional)
```

### Kontekst (RAG - Retrieval Augmented Generation)
```
İstifadəçi sualı
   ↓
Müvafiq Firestore datası çəkilir (stok, satış, müştəri...)
   ↓
Groq-a kontekst + sual göndərilir
   ↓
Cavab (data əsaslı, dəqiq)

Nümunə:
User: "Bu ay ən çox hansı model satıldı?"
System: [satış datasını çəkir] + Groq
AI: "Bu ay ən çox 'Black Slim Fit' satıldı - 145 ədəd, ₼11,455."
```

### System Prompt nümunəsi
```
"Sən cins şalvar istehsalı ERP sisteminin köməkçisisən.
İstifadəçilərə Azərbaycan dilində (qrammatik düzgün) kömək et.
Texniki terminlər İngiliscə ola bilər.
Yalnız təqdim olunan data əsasında cavab ver.
Dəqiq rəqəmlər və faktlar ver.
Əgər data yoxdursa, bunu bildir."
```

---

## 12.4 CLOUD FUNCTION NÜMUNƏSİ

```javascript
const Groq = require('groq-sdk');

exports.aiAssistant = functions.https.onCall(async (data, context) => {
  // Auth yoxla
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated');

  const { prompt, useCase, language = 'az', contextData } = data;

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const systemPrompts = {
    summary: `Sən maliyyə analitikisən. ${language === 'az' ? 'Azərbaycan' : 'İngilis'} dilində xülasə yaz.`,
    description: `Sən moda kopirayterisən. Cəlbedici məhsul təsviri yaz.`,
    email: `Sən peşəkar biznes yazışması mütəxəssisisən.`,
    chatbot: `Sən ERP köməkçisisən. Data əsasında dəqiq cavab ver.`,
  };

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompts[useCase] },
      { role: 'user', content: contextData 
          ? `Kontekst: ${JSON.stringify(contextData)}\n\nSual: ${prompt}`
          : prompt },
    ],
    temperature: 0.7,
    max_tokens: 1024,
  });

  return { response: completion.choices[0].message.content };
});
```

### Client istifadəsi
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const aiAssistant = httpsCallable(getFunctions(), 'aiAssistant');

async function generateDescription(product) {
  const result = await aiAssistant({
    useCase: 'description',
    language: 'az',
    prompt: `Bu məhsul üçün təsvir: ${product.name}`,
    contextData: product.attributes,
  });
  return result.data.response;
}
```

---

## 12.5 AI UI KOMPONENTLƏRİ

```
- "AI ilə yaz" düyməsi (description, email yanında)
- AI Insights paneli (dashboard)
- Chatbot widget (floating)
- Loading state ("AI düşünür...")
- Nəticəni redaktə imkanı (AI draft → user edit)
```

---

## 12.6 DİL DƏSTƏYİ (AZ/EN)

```
- Bütün AI cavabları seçilmiş dildə
- UI dili dəyişəndə AI dili də dəyişir
- Çoxdilli məhsul description (eyni vaxtda AZ+EN generasiya)
- next-intl ilə inteqrasiya
```

---

**Növbəti fayl:** `13_NOTIFICATIONS.md` - Bildirişlər
