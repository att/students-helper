import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Pencil, RotateCcw, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./lib/supabase";
import { timeAgo } from "./quests";
import { useQuestTitles } from "./useQuestTitles";

function Tile({ label, value, sub }) {
  return (
    <div className="rounded-[24px] border border-[#EEDFD2] bg-white p-5 shadow-[0_8px_25px_rgba(72,52,38,.05)]">
      <div className="text-sm font-semibold text-[#6B747C]">{label}</div>
      <div dir="ltr" className="mt-1 text-right font-mono text-4xl font-black text-[#183E49] sm:text-5xl">{value}</div>
      {sub && <div className="mt-1 text-xs text-[#927E70]">{sub}</div>}
    </div>
  );
}

function ResetModal({ onClose, onDone }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm(e) {
    e.preventDefault();
    if (!code || busy) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("admin_reset", { passcode: code });
    setBusy(false);
    if (err) {
      setError(err.code === "28000" ? "קוד שגוי" : `האיפוס נכשל (${err.code ?? "unknown"}): ${err.message}`);
      return;
    }
    onDone();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <motion.form
        role="dialog"
        aria-modal="true"
        initial={{ scale: .95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: .95, opacity: 0 }}
        onSubmit={confirm}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl"
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDE8E4] text-[#B3402A]"><AlertTriangle size={24} /></div>
        <h2 className="text-xl font-black text-[#3E342D]">לאפס את כל הנתונים?</h2>
        <p className="mt-2 text-sm leading-6 text-[#675246]">
          כל המשתתפים וכל ה־UNLOCKS יימחקו לצמיתות, והסטודנטים יתבקשו להזין שם מחדש. אי אפשר לשחזר.
        </p>
        <label htmlFor="code" className="mb-1 mt-4 block text-sm font-semibold">קוד מנחה</label>
        <input
          id="code"
          type="password"
          autoFocus
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          dir="ltr"
          className="h-12 w-full rounded-2xl border border-[#E7D9CC] bg-[#FFFCF8] px-4 outline-none focus:border-[#B3402A]"
        />
        <div className="mt-2 min-h-5 text-sm text-[#B3402A]">{error}</div>
        <div className="mt-3 flex gap-3">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-2xl border border-[#E7D9CC] font-bold text-[#3E342D] hover:bg-[#FFF9F2]">ביטול</button>
          <button type="submit" disabled={!code || busy} className="h-12 flex-1 rounded-2xl bg-[#B3402A] font-bold text-white enabled:hover:bg-[#92331F] disabled:opacity-40">
            {busy ? "..." : "כן, לאפס הכול"}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function EditTaskNamesModal({ quests, onClose, onSaved }) {
  const [titles, setTitles] = useState(() => quests.map(({ id, title, text }) => ({ quest_id: id, title, subtitle: text })));
  const [confirmed, setConfirmed] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    if (!confirmed || !code || busy || titles.some((item) => !item.title.trim() || item.subtitle.length > 160)) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("admin_update_quest_titles_and_reset", {
      passcode: code,
      titles: titles.map((item) => ({ quest_id: item.quest_id, title: item.title.trim(), subtitle: item.subtitle.trim() })),
    });
    setBusy(false);
    if (err) {
      if (err.code === "28000") {
        setError("קוד מנחה שגוי");
        return;
      }
      setError(`השמירה נכשלה (${err.code ?? "unknown"}): ${err.message}`);
      return;
    }
    await onSaved();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" onClick={onClose}>
      <motion.form
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-task-titles-heading"
        initial={{ scale: .95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: .95, opacity: 0 }}
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="edit-task-titles-heading" className="text-xl font-black text-[#3E342D]">עריכת משימות</h2>
            <p className="mt-1 text-sm text-[#675246]">אפשר לערוך את הכותרת ואת הטקסט בעברית.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="סגירה" className="rounded-xl p-2 text-[#6B747C] hover:bg-[#FFF9F2]"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {titles.map((item, index) => (
            <div key={item.quest_id} className="rounded-2xl border border-[#EEDFD2] bg-[#FFFCF8] p-3">
              <span dir="ltr" className="mb-2 block text-left font-mono text-xs font-bold text-[#183E49]">{quests[index].title}</span>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs font-semibold text-[#6B747C]">כותרת</span>
                <input
                  maxLength={60}
                  required
                  value={item.title}
                  onChange={(e) => setTitles((current) => current.map((entry) => entry.quest_id === item.quest_id ? { ...entry, title: e.target.value } : entry))}
                  dir="auto"
                  className="h-10 w-full rounded-xl border border-[#E7D9CC] bg-white px-3 outline-none focus:border-[#2A9D8F]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#6B747C]">טקסט בעברית</span>
                <textarea
                  maxLength={160}
                  rows={2}
                  value={item.subtitle}
                  onChange={(e) => setTitles((current) => current.map((entry) => entry.quest_id === item.quest_id ? { ...entry, subtitle: e.target.value } : entry))}
                  dir="rtl"
                  className="w-full resize-y rounded-xl border border-[#E7D9CC] bg-white px-3 py-2 outline-none focus:border-[#2A9D8F]"
                />
              </label>
              {item.subtitle.length > 160 && <span className="text-xs text-[#B3402A]">עד 160 תווים</span>}
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-[#F0BE8D] bg-[#FFF0E2] p-3 text-sm leading-6 text-[#7A421E]">
          שמירת השינויים תמחק את כל שמות המשתתפים ואת ההתקדמות. הפעילות תתחיל מחדש.
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm leading-5 text-[#3E342D]">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4 accent-[#16697A]" />
          <span>אני מאשר.ת לאפס את הנתונים ולהתחיל מחדש</span>
        </label>
        <label htmlFor="edit-task-code" className="mb-1 mt-4 block text-sm font-semibold">קוד מנחה</label>
        <input
          id="edit-task-code"
          type="password"
          autoComplete="off"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          dir="ltr"
          className="h-12 w-full rounded-2xl border border-[#E7D9CC] bg-[#FFFCF8] px-4 outline-none focus:border-[#2A9D8F]"
        />
        <div className="mt-2 min-h-5 text-sm text-[#B3402A]">{error}</div>
        <div className="mt-3 flex gap-3">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-2xl border border-[#E7D9CC] font-bold text-[#3E342D] hover:bg-[#FFF9F2]">ביטול</button>
          <button type="submit" disabled={!confirmed || !code || busy || titles.some((item) => !item.title.trim() || item.subtitle.length > 160)} className="h-12 flex-1 rounded-2xl bg-[#16697A] font-bold text-white enabled:hover:bg-[#123B46] disabled:opacity-40">
            {busy ? "..." : "שמירה והתחלה מחדש"}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

export default function Admin() {
  const { quests, questById, reloadQuestTitles } = useQuestTitles();
  const [unlocks, setUnlocks] = useState([]);
  const [people, setPeople] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const [u, p] = await Promise.all([
      supabase.from("unlocks").select("id, quest_id, created_at, user_id, profiles(username)").order("created_at", { ascending: false }).limit(1000),
      supabase.from("profiles").select("user_id").limit(1000),
    ]);
    if (!u.error) setUnlocks(u.data ?? []);
    if (!p.error) setPeople(p.data ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-unlocks")
      .on("postgres_changes", { event: "*", schema: "public", table: "unlocks" }, () => load())
      .subscribe();
    const t = setInterval(() => {
      setTick((n) => n + 1);
      load();
    }, 10000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(t);
    };
  }, [load]);

  const stats = useMemo(() => {
    const perQuest = {};
    unlocks.forEach((r) => {
      perQuest[r.quest_id] = (perQuest[r.quest_id] ?? 0) + 1;
    });
    const total = unlocks.length;
    const max = people.length * quests.length;
    return {
      perQuest,
      total,
      activeQuests: Object.values(perQuest).filter(Boolean).length,
      pct: max ? Math.round((total / max) * 100) : 0,
    };
  }, [unlocks, people]);

  async function afterReset() {
    setResetOpen(false);
    await load();
    setNotice("הנתונים אופסו");
    setTimeout(() => setNotice(""), 4000);
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#FFF9F2] text-[#23303D]">
      <header className="bg-[#123B46] px-5 py-6 text-white sm:py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-[#FFD6A5]">לוח מנחה · מתעדכן אוטומטית</div>
            <h1 dir="ltr" className="mt-1 text-right font-mono text-3xl font-black leading-none sm:text-5xl">UNLOCK <span className="text-[#7BD8CF]">YOUR NEXT MOVE</span></h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditOpen(true)} className="flex h-11 items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-4 text-sm font-bold hover:bg-white/20">
              <Pencil size={16} /> עריכת שמות משימות
            </button>
            <button onClick={() => setResetOpen(true)} className="flex h-11 items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-4 text-sm font-bold hover:bg-[#B3402A]">
              <RotateCcw size={16} /> איפוס כל הנתונים
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:py-8">
        <AnimatePresence>
          {notice && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl bg-[#EAF8F5] px-4 py-3 text-sm font-semibold text-[#21877C]">{notice}</motion.div>}
        </AnimatePresence>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <Tile label="משתתפים" value={people.length} />
          <Tile label="משימות שהושלמו" value={stats.total} sub={`מתוך ${people.length * quests.length} אפשריות`} />
          <Tile label="משימות עם פעילות" value={stats.activeQuests} sub={`מתוך ${quests.length}`} />
        </section>

        <section className="rounded-[28px] border border-[#EEDFD2] bg-white p-5 shadow-[0_8px_25px_rgba(72,52,38,.05)] sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">התקדמות הקבוצה</h2>
            <span dir="ltr" className="font-mono text-2xl font-black text-[#183E49]">{stats.pct}%</span>
          </div>
          <div className="h-5 overflow-hidden rounded-full bg-[#F2E7DC]">
            <motion.div animate={{ width: `${stats.pct}%` }} className="h-full rounded-full bg-gradient-to-l from-[#F4A261] to-[#2A9D8F]" />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <section className="rounded-[28px] border border-[#EEDFD2] bg-white p-5 shadow-[0_8px_25px_rgba(72,52,38,.05)] sm:p-6">
            <h2 className="mb-4 text-lg font-black">לפי משימה</h2>
            <div className="space-y-4">
              {quests.map((q) => {
                const n = stats.perQuest[q.id] ?? 0;
                const w = people.length ? (n / people.length) * 100 : 0;
                return (
                  <div key={q.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <span dir="ltr" className="font-mono text-sm font-extrabold text-[#183E49]">{q.title}</span>
                        <span className="mr-2 text-xs text-[#927E70]">{q.text}</span>
                      </div>
                      <span dir="ltr" className="shrink-0 font-mono text-sm font-bold">{n}/{people.length}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-[#F2E7DC]"><div className="h-full rounded-full bg-[#2A9D8F] transition-all" style={{ width: `${w}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[28px] bg-[#FFE9D6] p-5 shadow-[0_8px_25px_rgba(72,52,38,.05)] sm:p-6">
            <h2 className="mb-3 text-lg font-black text-[#3E342D]">מה קורה עכשיו</h2>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {!loaded && <div className="text-sm text-[#927E70]">טוען...</div>}
              {loaded && unlocks.length === 0 && <div className="text-sm text-[#927E70]">עוד אין עדכונים.</div>}
              {unlocks.slice(0, 30).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/75 px-3.5 py-2.5">
                  <div className="min-w-0 text-sm">
                    <strong dir="auto">{r.profiles?.username ?? "משתתף.ת"}</strong>
                    <span className="mr-1 text-[#675246]">הוסיף.ה לקבוצה</span>
                    <span dir="ltr" className="mr-2 font-mono text-xs font-bold text-[#167C73]">{questById[r.quest_id]?.title}</span>
                  </div>
                  <span className="shrink-0 text-xs text-[#927E70]">{timeAgo(r.created_at)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

      </main>

      <AnimatePresence>
        {editOpen && <EditTaskNamesModal quests={quests} onClose={() => setEditOpen(false)} onSaved={async () => { await reloadQuestTitles(); await load(); setEditOpen(false); setNotice("המשימות עודכנו והנתונים אופסו"); setTimeout(() => setNotice(""), 4000); }} />}
        {resetOpen && <ResetModal onClose={() => setResetOpen(false)} onDone={afterReset} />}
      </AnimatePresence>
    </div>
  );
}
