import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Sparkles, Mic } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/coach")({
  component: Coach,
});

type Msg = { role: "ai" | "user"; text: string };

const initial: Msg[] = [
  {
    role: "ai",
    text: "أهلاً أحمد 👋 استشفاؤك اليوم ممتاز ٨٨٪. جاهز لتمرين قوة انفجاري؟ أو تفضل شيء أخف؟",
  },
  { role: "user", text: "أشعر بتعب في الكتف الأيسر، ما البديل؟" },
  {
    role: "ai",
    text: "فهمت. سأستبدل تمارين الضغط بتمارين السحب والأرجل، مع تمارين تحرير للكتف. المدة ٣٢ د، حرق تقديري ٤٢٠ سعرة. أبدأ لك؟",
  },
];

const suggestions = [
  "خطة تغذية اليوم",
  "لماذا تألمني ركبتي؟",
  "تمرين ٢٠ د سريع",
  "كيف أزيد الكتلة؟",
];

function Coach() {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");

  const send = (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setInput("");
    setTimeout(() => {
      setMsgs((m) => [
        ...m,
        {
          role: "ai",
          text: "استلمت رسالتك — سأحضّر لك خطة مخصصة خلال لحظات. هذا نموذج تجريبي حالياً.",
        },
      ]);
    }, 700);
  };

  return (
    <PageShell>
      <header className="relative p-6 pt-10 animate-enter">
        <div className="flex items-center gap-3 mb-2">
          <div className="size-10 rounded-2xl bg-primary/10 border border-primary/30 grid place-items-center animate-glow">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
              مدرب كينيتك
            </p>
            <h1 className="text-2xl font-black leading-none">مدربك الذكي</h1>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">متصل الآن · يتعلم من بياناتك</p>
      </header>

      {/* Messages */}
      <section className="relative px-6 space-y-3 mb-4">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`flex animate-enter ${m.role === "user" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground font-bold rounded-bl-sm"
                  : "bg-surface border border-border text-foreground rounded-br-sm"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </section>

      {/* Suggestions */}
      <section className="relative px-6 mb-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="flex-shrink-0 px-3 py-2 rounded-full text-xs font-bold bg-surface border border-border text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* Composer */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-6 z-40">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="bg-card/90 backdrop-blur-2xl border border-border rounded-2xl p-2 flex items-center gap-2 shadow-2xl"
        >
          <button
            type="button"
            className="size-9 rounded-xl bg-surface grid place-items-center text-muted-foreground"
            aria-label="صوت"
          >
            <Mic className="size-4" />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اسأل المدرب…"
            className="flex-1 bg-transparent text-sm py-2 focus:outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center active:scale-95"
            aria-label="إرسال"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>

      <BottomNav />
    </PageShell>
  );
}
