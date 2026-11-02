import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Sparkles, Users, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./lib/supabase";
import { quests, questById, timeAgo } from "./quests";

const NAME_RE = /^[\p{L}\p{N} ._-]{2,24}$/u;

function Card({ className = "", children }) {
  return <div className={className}>{children}</div>;
}

function NameGate({ onJoin }) {
  const [name, setName] = useState("");
  const [availability, setAvailability] = useState("idle"); // idle | checking | free | taken
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim().replace(/\s+/g, " ");
  const valid = NAME_RE.test(trimmed);

  useEffect(() => {
    setError("");
    if (!valid) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("username_available", { name: trimmed });
      if (cancelled) return;
      if (error) setAvailability("idle");
      else setAvailability(data ? "free" : "taken");
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmed, valid]);

  async function submit(e) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      let { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: authError } = await supabase.auth.signInAnonymously();
        if (authError) throw authError;
        ({ data: sessionData } = await supabase.auth.getSession());
      }
      const userId = sessionData.session.user.id;
      const { error: insertError } = await supabase.from("profiles").insert({ user_id: userId, username: trimmed });
      if (insertError) {
        if (insertError.code === "23505") {
          setAvailability("taken");
          return;
        }
        throw insertError;
      }
      onJoin({ user_id: userId, username: trimmed });
    } catch {
      setError("משהו השתבש, נסו שוב בעוד רגע.");
    } finally {
      setBusy(false);
    }
  }

  const hint = !trimmed
    ? ""
    : !valid
      ? "2–24 תווים: אותיות, ספרות, רווח, נקודה, מקף או קו תחתון"
      : availability === "checking"
        ? "בודק..."
        : availability === "taken"
          ? "השם הזה כבר תפוס, נסו להוסיף אות או מספר"
          : availability === "free"
            ? "השם פנוי ✓"
            : "";

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#123B46] px-4 text-[#23303D]">
      <form onSubmit={submit} className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl sm:p-8">
        <div dir="ltr" className="mb-5 font-mono text-2xl font-black text-[#123B46]">
          UNLOCK <span className="text-[#2A9D8F]">YOUR NEXT MOVE</span>
        </div>
        <label htmlFor="name" className="mb-2 block font-semibold">קודם כל, איך קוראים לך?</label>
        <input
          id="name"
          autoFocus
          maxLength={24}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="השם הפרטי שלך"
          className="h-12 w-full rounded-2xl border border-[#E7D9CC] bg-[#FFFCF8] px-4 outline-none focus:border-[#2A9D8F]"
        />
        <div className={`mt-2 min-h-5 text-sm ${availability === "taken" || (trimmed && !valid) || error ? "text-[#B3402A]" : "text-[#21877C]"}`}>{error || hint}</div>
        <button
          type="submit"
          disabled={!valid || availability === "taken" || availability === "checking" || busy}
          className="mt-4 h-12 w-full rounded-2xl bg-[#16697A] font-bold text-white transition enabled:hover:bg-[#123B46] disabled:opacity-40"
        >
          {busy ? "..." : "יאללה, מתחילים"}
        </button>
        <p className="mt-4 text-xs leading-5 text-[#6B747C]">הזהות שלך נשמרת בדפדפן הזה. בלי סיסמה ובלי הרשמה.</p>
      </form>
    </div>
  );
}

export default function UnlockYourNextMove() {
  const [profile, setProfile] = useState(undefined); // undefined = loading, null = needs name
  const [done, setDone] = useState([]);
  const [unlocks, setUnlocks] = useState([]);
  const [people, setPeople] = useState([]);
  const [celebration, setCelebration] = useState(null);
  const [, setTick] = useState(0);
  const toastTimer = useRef(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return setProfile(null);
      const { data: p } = await supabase.from("profiles").select("user_id, username").eq("user_id", user.id).maybeSingle();
      setProfile(p ?? null);
    })();
  }, []);

  const showToast = useCallback((name, quest) => {
    setCelebration({ name, quest });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setCelebration(null), 2600);
  }, []);

  const myId = profile?.user_id;
  const loadData = useCallback(async () => {
    const [u, p] = await Promise.all([
      supabase
        .from("unlocks")
        .select("id, quest_id, created_at, user_id, profiles(username)")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("profiles").select("user_id, username").limit(1000),
    ]);
    const rows = u.data ?? [];
    setUnlocks(rows);
    setPeople(p.data ?? []);
    // Profile vanished (admin reset): ask for a name again.
    if (!p.error && myId && !(p.data ?? []).some((x) => x.user_id === myId)) {
      setProfile(null);
      setDone([]);
    }
    return rows;
  }, [myId]);

  const feed = useMemo(() => unlocks.slice(0, 50), [unlocks]);
  const stats = useMemo(() => {
    const counts = {};
    unlocks.forEach((r) => { counts[r.user_id] = (counts[r.user_id] ?? 0) + 1; });
    return people
      .map((p) => ({ ...p, count: counts[p.user_id] ?? 0 }))
      .sort((a, b) => b.count - a.count || a.username.localeCompare(b.username));
  }, [unlocks, people]);

  useEffect(() => {
    if (!profile) return;
    supabase.from("unlocks").select("quest_id").eq("user_id", profile.user_id).then(({ data }) => setDone((data ?? []).map((r) => r.quest_id)));
    loadData();
    const channel = supabase
      .channel("unlocks-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "unlocks" }, async (payload) => {
        const rows = await loadData();
        if (payload.new.user_id === profile.user_id) return;
        const row = rows.find((r) => r.id === payload.new.id);
        if (row) showToast(row.profiles?.username ?? "מישהו.י", questById[row.quest_id]?.title ?? "");
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "unlocks" }, () => loadData())
      .subscribe();
    const tick = setInterval(() => {
      setTick((n) => n + 1);
      loadData();
    }, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(tick);
    };
  }, [profile, loadData, showToast]);

  const progress = useMemo(() => Math.round((done.length / quests.length) * 100), [done]);

  async function toggleQuest(quest) {
    if (done.includes(quest.id)) {
      setDone((d) => d.filter((id) => id !== quest.id));
      const { data, error } = await supabase.from("unlocks").delete().eq("user_id", profile.user_id).eq("quest_id", quest.id).select("id");
      if (error || !data?.length) setDone((d) => [...d, quest.id]);
      loadData();
      return;
    }
    setDone((d) => [...d, quest.id]);
    showToast(profile.username, quest.title);
    const { error } = await supabase.from("unlocks").insert({ user_id: profile.user_id, quest_id: quest.id });
    if (error && error.code !== "23505") {
      setDone((d) => d.filter((id) => id !== quest.id));
      setCelebration(null);
    }
    loadData();
  }

  if (profile === undefined) return <div className="min-h-screen bg-[#123B46]" />;
  if (profile === null) return <NameGate onJoin={setProfile} />;

  return (
    <div dir="rtl" className="min-h-screen bg-[#FFF9F2] text-[#23303D]">
      <AnimatePresence>
        {celebration && (
          <motion.div initial={{ opacity: 0, y: -24, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -18 }} className="fixed top-4 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-[24px] bg-[#16697A] p-4 text-white shadow-xl">
            <button onClick={() => setCelebration(null)} className="absolute left-3 top-3 opacity-80" aria-label="סגירה"><X size={18}/></button>
            <div className="flex items-center gap-3">
              <Sparkles className="text-[#FFD166]" />
              <div>
                <div className="font-bold">{celebration.name} הוסיף.ה עוד UNLOCK לקבוצה!</div>
                <div dir="ltr" className="mt-0.5 text-sm font-mono text-[#DDF5F1]">{celebration.quest}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="relative overflow-hidden bg-[#123B46] px-5 pb-12 pt-6 text-white sm:pb-14 sm:pt-8">
        <div className="absolute -left-14 -top-16 h-52 w-52 rounded-full bg-[#F4A261]/20 blur-2xl" />
        <div className="absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-[#2A9D8F]/30 blur-2xl" />
        <div className="relative mx-auto max-w-5xl">
          <p className="mb-2 text-sm font-semibold text-[#FFD6A5]">היום הזה שייך לכם.</p>
          <h1 dir="ltr" className="max-w-3xl text-left font-mono text-4xl font-black leading-[.98] sm:text-6xl">UNLOCK<br/><span className="text-[#7BD8CF]">YOUR NEXT MOVE</span></h1>
          <p className="mt-5 hidden max-w-xl text-base leading-7 text-[#EDF7F5] sm:block">כל שאלה, שיחה או צעד קטן יכולים לפתוח משהו חדש. לא צריך לעשות הכול. פשוט לבחור איפה בא לכם לנסות.</p>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-7 grid max-w-5xl gap-6 px-4 pb-14 lg:grid-cols-[1.45fr_.8fr] xl:max-w-7xl xl:grid-cols-[1.4fr_.75fr_.65fr]">
        <section>
          <Card className="mb-3 rounded-[24px] border border-[#EEDFD2] bg-white/95 shadow-[0_12px_40px_rgba(54,47,41,.08)] sm:mb-5 sm:rounded-[28px]">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:gap-6 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <div className="text-sm leading-5 text-[#6B747C]">שלום,</div>
                <div dir="auto" className="truncate text-xl font-black leading-7 sm:mt-1 sm:text-2xl sm:leading-8">{profile.username}</div>
              </div>
              <div className="w-40 shrink-0 sm:w-48">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-[#6B747C]">
                  <span>ההתקדמות שלי</span>
                  <span dir="ltr" className="font-mono font-bold text-[#183E49]">{done.length}/{quests.length}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#F2E7DC]"><motion.div animate={{ width: `${progress}%` }} className="h-full rounded-full bg-gradient-to-l from-[#F4A261] to-[#2A9D8F]" /></div>
              </div>
            </div>
          </Card>

          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            {quests.map((q) => {
              const checked = done.includes(q.id);
              const Icon = q.icon;
              return (
                <motion.button key={q.id} whileHover={{ y: -2 }} whileTap={{ scale: .985 }} onClick={() => toggleQuest(q)} className={`group flex items-center gap-3 rounded-2xl border p-3 text-right transition sm:min-h-36 sm:items-start sm:gap-4 sm:rounded-[26px] sm:p-5 ${checked ? "border-[#8FD7CF] bg-[#EAF8F5] shadow-sm" : "border-[#EEDFD2] bg-white shadow-[0_8px_25px_rgba(72,52,38,.05)] hover:border-[#F0BE8D] hover:shadow-md"}`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl ${checked ? "bg-[#2A9D8F] text-white" : "bg-[#FFF0E2] text-[#C66A2B]"}`}>{checked ? <Check size={20}/> : <Icon size={19}/>}</div>
                  <div className="min-w-0 flex-1">
                    <div dir="ltr" className="text-left font-mono text-xs font-extrabold tracking-tight text-[#183E49] sm:text-sm">{q.title}</div>
                    <p className="mt-0.5 text-[13px] leading-5 text-[#66717A] sm:mt-2 sm:text-sm sm:leading-6">{q.text}</p>
                    <div className={`mt-3 hidden text-xs font-semibold sm:block ${checked ? "text-[#21877C]" : "text-[#C77A40]"}`}>{checked ? "נפתח ✓ · לחיצה לביטול" : "עשיתי את זה →"}</div>
                  </div>
                  <div className={`h-6 w-6 shrink-0 rounded-full border-2 sm:hidden ${checked ? "border-[#2A9D8F] bg-[#2A9D8F]" : "border-[#E3CDB8]"}`} />
                </motion.button>
              );
            })}
          </div>
        </section>

        <aside>
          <Card className="overflow-hidden rounded-[28px] border-0 bg-[#FFE9D6] shadow-[0_12px_35px_rgba(72,52,38,.08)] lg:sticky lg:top-5">
            <div className="p-0">
              <div className="bg-[#F7C99F] p-5">
                <div className="mb-2 flex items-center gap-2 text-[#7A421E]"><Users size={20}/><span className="text-xs font-bold tracking-wider">WE'RE IN THIS TOGETHER</span></div>
                <h2 className="text-xl font-black text-[#3E342D]">בואו נראה כמה נצליח לפתוח יחד</h2>
                <p className="mt-2 text-sm leading-6 text-[#675246]">כל UNLOCK של אחד או אחת מאיתנו מוסיף להתקדמות של כל הקבוצה. אין תחרות, רק קצת אומץ שמצטבר לאורך היום.</p>
              </div>
              <div className="max-h-60 min-h-32 space-y-3 overflow-y-auto p-5 lg:max-h-[38vh]">
                {feed.length === 0 && <div className="text-sm text-[#927E70]">עוד אף אחד לא פתח. תהיו הראשונים!</div>}
                {feed.map((item) => (
                  <motion.div key={item.id} initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} className="rounded-2xl bg-white/75 p-3.5 shadow-sm">
                    <div className="text-sm"><strong>{item.profiles?.username ?? "מישהו.י"}</strong> הוסיף.ה לקבוצה</div>
                    <div dir="ltr" className="mt-1.5 text-left font-mono text-xs font-bold text-[#167C73]">+ {questById[item.quest_id]?.title}</div>
                    <div className="mt-1 text-xs text-[#927E70]">{timeAgo(item.created_at)}</div>
                  </motion.div>
                ))}
              </div>
              <div className="mx-5 mb-5 rounded-2xl border border-[#E7CBB1] bg-white/45 p-4 text-sm leading-6 text-[#705C4D]">
                <span className="font-bold">הרעיון:</span> כל אחד עושה צעד קטן משלו, וביחד נוצרת תנועה בחדר.
              </div>
            </div>
          </Card>
        </aside>

        <aside className="lg:col-span-2 xl:col-span-1">
          <Card className="flex max-h-96 flex-col overflow-hidden rounded-[28px] border border-[#EEDFD2] bg-white shadow-[0_12px_35px_rgba(72,52,38,.06)] xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)]">
            <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-1 pt-4">
              <div>
              <h2 className="text-base font-black text-[#3E342D]">התקדמות הקבוצה</h2>
                <div className="mt-1 text-xs text-[#6B747C]">{unlocks.length} משימות הושלמו מתוך {people.length * quests.length}</div>
              </div>
              <span className="text-xs text-[#927E70]">{people.length} משתתפים</span>
            </div>
            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
              {stats.map((p) => (
                <div key={p.user_id} className={`flex items-center gap-3 rounded-2xl px-3 py-1.5 ${p.user_id === profile.user_id ? "bg-[#EAF8F5]" : ""}`}>
                  <span dir="auto" className="min-w-0 flex-1 truncate text-sm font-semibold">{p.username}</span>
                  <div className="h-2 w-14 shrink-0 overflow-hidden rounded-full bg-[#F2E7DC]"><div className="h-full rounded-full bg-[#2A9D8F]" style={{ width: `${(p.count / quests.length) * 100}%` }} /></div>
                  <span dir="ltr" className="w-9 shrink-0 text-left font-mono text-xs font-bold text-[#183E49]">{p.count}/{quests.length}</span>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </main>
    </div>
  );
}
