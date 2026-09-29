import type { Locale } from "./i18n";
export type Preferences = {
  locale: Locale;
  hourCycle: "h23" | "h12";
  dateFormat: string;
  timezone: string;
  theme: "light" | "dark";
};
export type User = {
  id: string;
  name: string;
  email: string;
  photo: string | null;
  preferences: Preferences;
};
export type Event = {
  id: string;
  title: string;
  start: string;
  end: string;
  category: "work" | "personal" | "health" | "study";
  completed: boolean;
};
export type Draft = Pick<Event, "title" | "start" | "end" | "category">;
