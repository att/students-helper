import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { quests as defaultQuests } from "./quests";

export function useQuestTitles() {
  const [titles, setTitles] = useState({});

  const reloadQuestTitles = useCallback(async () => {
    const { data, error } = await supabase.from("quest_titles").select("quest_id, title");
    if (!error) setTitles(Object.fromEntries((data ?? []).map((row) => [row.quest_id, row.title])));
  }, []);

  useEffect(() => {
    reloadQuestTitles();
    const interval = setInterval(reloadQuestTitles, 15000);
    return () => clearInterval(interval);
  }, [reloadQuestTitles]);

  const quests = useMemo(
    () => defaultQuests.map((quest) => ({ ...quest, title: titles[quest.id] ?? quest.title })),
    [titles],
  );
  const questById = useMemo(() => Object.fromEntries(quests.map((quest) => [quest.id, quest])), [quests]);

  return { quests, questById, reloadQuestTitles };
}