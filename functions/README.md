# Cloud Functions

Server-only məntiq (spec 16.3). Tətbiqin əsas axını (FIFO/AVCO, stok, faktura)
client tərəfdə Firestore transaction-ları ilə işləyir; bu funksiyalar yalnız
server tələb edən hissələri əhatə edir.

## Funksiyalar

| Funksiya | Növ | Təyinat |
|----------|-----|---------|
| `aiAssistant` | callable | Groq AI proxy (açar serverdə qalır) |
| `checkOverstock` | scheduled (gündəlik 08:00) | Overstock bildirişləri |
| `arReminders` | scheduled (gündəlik 09:00) | Vaxtı keçən debitor xatırlatması |

## Quraşdırma və deploy

```bash
cd functions
npm install

# Groq açarını secret kimi əlavə et
firebase functions:secrets:set GROQ_API_KEY

npm run deploy
```

## Qeyd

`aiAssistant` deploy olunduqdan sonra client-də `/api/ai/generate` route-u əvəzinə
`httpsCallable(getFunctions(), 'aiAssistant')` istifadə etmək daha təhlükəsizdir
(Vercel server route da işləyir, amma Cloud Function Firebase auth ilə inteqrasiyalıdır).
