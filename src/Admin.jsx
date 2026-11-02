import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RotateCcw, Users, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./lib/supabase";
import { quests, questById, timeAgo } from "./quests";

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
      setError(err.code === "28000" ? "קוד שגוי" : "האיפוס נכשל. בדקו שהרצתם את supabase/admin.sql.");
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

export default function Admin() {
  const [unlocks, setUnlocks] = useState([]);
  const [people, setPeople] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const [u, p] = await Promise.all([
      supabase.from("unlocks").select("id, quest_id, created_at, user_id, profiles(username)").order("created_at", { ascending: false }).limit(1000),
      supabase.from("profiles").select("user_id, username").limit(1000),
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
    const counts = {};
    const perQuest = {};
    unlocks.forEach((r) => {
      counts[r.user_id] = (counts[r.user_id] ?? 0) + 1;
      perQuest[r.quest_id] = (perQuest[r.quest_id] ?? 0) + 1;
    });
    const list = people
      .map((p) => ({ ...p, count: counts[p.user_id] ?? 0 }))
      .sort((a, b) => b.count - a.count || a.username.localeCompare(b.username));
    const total = unlocks.length;
    const max = people.length * quests.length;
    return {
      list,
      perQuest,
      total,
      completed: list.filter((p) => p.count === quests.length).length,
      pct: max ? Math.round((total / max) * 100) : 0,
      avg: people.length ? (total / people.length).toFixed(1) : "0",
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
          <button onClick={() => setResetOpen(true)} className="flex h-11 items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-4 text-sm font-bold hover:bg-[#B3402A]">
            <RotateCcw size={16} /> איפוס כל הנתונים
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:py-8">
        <AnimatePresence>
          {notice && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl bg-[#EAF8F5] px-4 py-3 text-sm font-semibold text-[#21877C]">{notice}</motion.div>}
        </AnimatePresence>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Tile label="משתתפים" value={people.length} />
          <Tile label="משימות שהושלמו" value={stats.total} sub={`מתוך ${people.length * quests.length} אפשריות`} />
          <Tile label={`השלימו ${quests.length}/${quests.length}`} value={stats.completed} />
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
                    <strong dir="auto">{r.profiles?.username ?? "מישהו.י"}</strong>
                    <span dir="ltr" className="mr-2 font-mono text-xs font-bold text-[#167C73]">+ {questById[r.quest_id]?.title}</span>
                  </div>
                  <span className="shrink-0 text-xs text-[#927E70]">{timeAgo(r.created_at)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-[28px] border border-[#EEDFD2] bg-white p-5 shadow-[0_8px_25px_rgba(72,52,38,.05)] sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black"><Users size={20} /> משתתפים</h2>
          {people.length === 0 && loaded && <div className="text-sm text-[#927E70]">עוד אף אחד לא הצטרף.</div>}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {stats.list.map((p) => (
              <div key={p.user_id} className="rounded-2xl border border-[#EEDFD2] bg-[#FFFCF8] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span dir="auto" className="min-w-0 truncate font-semibold">{p.username}</span>
                  <span dir="ltr" className={`shrink-0 font-mono text-sm font-black ${p.count === quests.length ? "text-[#21877C]" : "text-[#183E49]"}`}>{p.count}/{quests.length}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F2E7DC]"><div className="h-full rounded-full bg-[#2A9D8F]" style={{ width: `${(p.count / quests.length) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {resetOpen && <ResetModal onClose={() => setResetOpen(false)} onDone={afterReset} />}
      </AnimatePresence>
    </div>
  );
}
