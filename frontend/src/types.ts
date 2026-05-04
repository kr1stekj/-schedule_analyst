/** Типы DTO: ответы /api и форма слота в UI / localStorage. */

export type UserPublic = {
  id: number;
  email: string;
  totp_enabled: boolean;
};

export type LoginResponse = {
  access_token: string | null;
  token_type: string;
  requires_2fa: boolean;
  challenge_token: string | null;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type ActivityType = {
  id: number;
  name: string;
  source: string;
};

export type SeedResult = {
  inserted: number;
  skipped_existing: number;
  distinct_in_file: number;
};

export type TOTPSetupResponse = {
  secret: string;
  otpauth_url: string;
  qr_png_base64: string;
};

/** Слот дня: в UI один формат; id — число с сервера или строка в localStorage */
export type LocalScheduleEntry = {
  id: string;
  start: string;
  end: string;
  activityTypeName: string;
  description: string;
};

/** Ответ GET/POST /api/schedule */
export type ScheduleApiRow = {
  id: number;
  schedule_date: string;
  start_time: string;
  end_time: string;
  activity_type_name: string;
  description: string | null;
};

export type ScheduleSummaryActivity = {
  activity_type_name: string;
  total_minutes: number;
  average_minutes_per_day: number;
  entries_count: number;
  days_count: number;
  frequency_per_day: number;
};

export type ScheduleSummaryEntry = {
  schedule_date: string;
  start_time: string;
  end_time: string;
  activity_type_name: string;
  description: string | null;
  duration_minutes: number;
};

export type ScheduleSummary = {
  start_date: string;
  end_date: string;
  days_total: number;
  total_scheduled_minutes: number;
  average_scheduled_minutes_per_day: number;
  total_free_minutes: number;
  average_free_minutes_per_day: number;
  activities: ScheduleSummaryActivity[];
  entries: ScheduleSummaryEntry[];
};
