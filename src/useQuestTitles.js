import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { quests as defaultQuests } from "./quests";

export function useQuestTitles() {
  const [titles, setTitles] = useState({});

  const reloadQuestTitles = useCallback(async () => {
    const { data, error } = await supabase.from("quest_titles").select("quest_id, title, subtitle");
    if (!error) setTitles(Object.fromEntries((data ?? []).map((row) => [row.quest_id, row])));
  }, []);

  useEffect(() => {
    reloadQuestTitles();
    const interval = setInterval(reloadQuestTitles, 15000);
    return () => clearInterval(interval);
  }, [reloadQuestTitles]);

  const quests = useMemo(
    () => defaultQuests.map((quest) => ({
      ...quest,
      title: titles[quest.id]?.title ?? quest.title,
      text: titles[quest.id]?.subtitle ?? quest.text,
    })),
    [titles],
  );
  const questById = useMemo(() => Object.fromEntries(quests.map((quest) => [quest.id, quest])), [quests]);

  return { quests, questById, reloadQuestTitles };
}