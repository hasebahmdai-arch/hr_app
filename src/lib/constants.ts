export const REQUEST_STATUSES = ["PENDING", "CANCELING", "CANCELLED", "COMPLETED", "REJECTED"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_TYPES = [
  "punch",
  "expense",
  "leave",
  "loans",
  "wfh",
  "official-duty",
  "relaxation",
  "travel",
] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_TYPE_PREFIX: Record<RequestType, string> = {
  punch: "ATT",
  expense: "EXP",
  leave: "LVE",
  loans: "LON",
  wfh: "WFH",
  "official-duty": "ODT",
  relaxation: "RLX",
  travel: "TRV",
};

export const TIMESHEET_STATUS_CODES = ["P", "M", "A", "S", "D", "R", "X", "O", "L", "SL", "T", "W", "H"] as const;
