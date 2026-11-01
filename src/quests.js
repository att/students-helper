import { Sparkles, Users, Heart, MessageCircle, UserRoundCheck, ArrowUpRight } from "lucide-react";

export const quests = [
  { id: 1, title: "UNLOCK A QUESTION", text: "שאלתי שאלה במהלך הרצאה", icon: MessageCircle },
  { id: 2, title: "UNLOCK A CONVERSATION", text: "ניגשתי למרצה או לאחד מאנשי הצוות", icon: Users },
  { id: 3, title: "UNLOCK FEEDBACK", text: "ביקשתי מהמראיין נקודה לשמר ונקודה לשפר", icon: ArrowUpRight },
  { id: 4, title: "UNLOCK SOMEONE ELSE", text: "נתתי פידבק חיובי לסטודנט.ית אחר.ת", icon: Heart },
  { id: 5, title: "UNLOCK YOUR PROFILE", text: "שיפרתי משהו בפרופיל הלינקדאין שלי", icon: UserRoundCheck },
  { id: 6, title: "UNLOCK A CONNECTION", text: "יצרתי קשר חדש ושלחתי הזמנה אישית בלינקדאין", icon: Sparkles },
];

export const questById = Object.fromEntries(quests.map((q) => [q.id, q]));

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "עכשיו";
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? "לפני דקה" : `לפני ${m} דקות`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "לפני שעה" : `לפני ${h} שעות`;
  return new Date(iso).toLocaleDateString("he-IL");
}
