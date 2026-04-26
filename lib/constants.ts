// Disposition constants for lead status tracking
export const DISPOSITIONS = {
  NEW: "NEW",
  CALLED_NO_ANSWER: "CALLED_NO_ANSWER",
  LEFT_VOICEMAIL: "LEFT_VOICEMAIL",
  CALLBACK_SCHEDULED: "CALLBACK_SCHEDULED",
  BOOKED: "BOOKED",
  NOT_INTERESTED: "NOT_INTERESTED",
  WRONG_NUMBER: "WRONG_NUMBER",
  DO_NOT_CALL: "DO_NOT_CALL",
} as const;

export type Disposition = (typeof DISPOSITIONS)[keyof typeof DISPOSITIONS];

export const DISPOSITION_LABELS: Record<Disposition, string> = {
  NEW: "New",
  CALLED_NO_ANSWER: "No Answer",
  LEFT_VOICEMAIL: "Left Voicemail",
  CALLBACK_SCHEDULED: "Callback Scheduled",
  BOOKED: "Booked",
  NOT_INTERESTED: "Not Interested",
  WRONG_NUMBER: "Wrong Number",
  DO_NOT_CALL: "Do Not Call",
};

export const DISPOSITION_COLORS: Record<Disposition, string> = {
  NEW: "bg-blue-600 text-white",
  CALLED_NO_ANSWER: "bg-yellow-600 text-white",
  LEFT_VOICEMAIL: "bg-orange-600 text-white",
  CALLBACK_SCHEDULED: "bg-purple-600 text-white",
  BOOKED: "bg-green-600 text-white",
  NOT_INTERESTED: "bg-gray-600 text-white",
  WRONG_NUMBER: "bg-red-600 text-white",
  DO_NOT_CALL: "bg-red-800 text-white",
};

// Settings keys
export const SETTING_KEYS = {
  TWILIO_ACCOUNT_SID: "TWILIO_ACCOUNT_SID",
  TWILIO_AUTH_TOKEN: "TWILIO_AUTH_TOKEN",
  TWILIO_PHONE_NUMBER: "TWILIO_PHONE_NUMBER",
  TWILIO_API_KEY_SID: "TWILIO_API_KEY_SID",
  TWILIO_API_KEY_SECRET: "TWILIO_API_KEY_SECRET",
  TWILIO_TWIML_APP_SID: "TWILIO_TWIML_APP_SID",
  GMAIL_SENDER_EMAIL: "GMAIL_SENDER_EMAIL",
  GMAIL_APP_PASSWORD: "GMAIL_APP_PASSWORD",
  GMAIL_SENDER_NAME: "GMAIL_SENDER_NAME",
  CLICKSEND_USERNAME: "CLICKSEND_USERNAME",
  CLICKSEND_API_KEY: "CLICKSEND_API_KEY",
} as const;

export type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  casualName: string;
  city: string;
  state: string;
  website: string;
  notes: string;
  disposition: Disposition;
  callbackDate: string;
  createdAt: string;
  updatedAt: string;
};
