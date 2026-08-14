export type SalaryStructure = "rate_per_visit" | "daily_rate" | "fixed_monthly";

export type EmployeeRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  role: "admin" | "doctor" | "nurse" | "caregiver";
  salary_structure: SalaryStructure;
  rate_per_visit: number;
  daily_rate: number;
  fixed_monthly: number;
  /** Peso amount subtracted for each late time-in (see LATE_CUTOFF_HOUR). */
  late_deduction: number;
  pay_periods: number;
  contact: string | null;
  active: boolean;
  archived_at: string | null;
  passcode_set_at: string | null;
};

export type AttendanceRow = {
  id: string;
  employee_id: string | null;
  user_id: string;
  type: "IN" | "OUT";
  logged_at: string;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  approved: boolean;
};

/** A time-in later than 8:00 AM counts as one "late". */
export const LATE_CUTOFF_HOUR = 8;

export function peso(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

export type ComputedPayroll = {
  employee: EmployeeRow;
  days_worked: number;
  visits: number;
  lates: number;
  gross_pay: number;
  /** Money already handed to the staff member during the period. */
  cash_advance: number;
  /** lates x the employee's configured per-late amount. */
  late_deduction: number;
  /** cash_advance + late_deduction, kept for the payroll register total. */
  total_deductions: number;
  net_pay: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Computes payroll for one employee from their attendance logs within the
 * selected period.
 *
 * Gross pay depends on the salary structure only. The two adjustments —
 * cash advance and late deduction — are calculated separately and shown
 * separately, so the admin can trace the final payable amount:
 *
 *   net pay = gross pay - cash advance - late deduction
 */
export function computePayroll(
  employee: EmployeeRow,
  logs: AttendanceRow[],
  cashAdvance: number,
  extraLateDeduction = 0,
): ComputedPayroll {
  const ins = logs.filter((l) => l.type === "IN");
  const outs = logs.filter((l) => l.type === "OUT");

  const outDays = new Set(outs.map((l) => dayKey(l.logged_at)));
  const inDays = new Set(ins.map((l) => dayKey(l.logged_at)));
  const completedDays = [...inDays].filter((d) => outDays.has(d));

  const days_worked = completedDays.length;
  const visits = ins.filter((l) => outDays.has(dayKey(l.logged_at))).length;
  const lates = ins.filter((l) => new Date(l.logged_at).getHours() >= LATE_CUTOFF_HOUR).length;

  let gross_pay = 0;
  if (employee.salary_structure === "rate_per_visit") {
    gross_pay = visits * Number(employee.rate_per_visit);
  } else if (employee.salary_structure === "daily_rate") {
    gross_pay = days_worked * Number(employee.daily_rate);
  } else {
    gross_pay = Number(employee.fixed_monthly) / Math.max(1, Number(employee.pay_periods) || 1);
  }
  gross_pay = Math.max(0, round2(gross_pay));

  const cash_advance = round2(Math.max(0, cashAdvance || 0));
  const late_deduction = round2(
    lates * Number(employee.late_deduction || 0) + Math.max(0, extraLateDeduction || 0),
  );
  const total_deductions = round2(cash_advance + late_deduction);
  const net_pay = round2(Math.max(0, gross_pay - total_deductions));

  return {
    employee,
    days_worked,
    visits,
    lates,
    gross_pay,
    cash_advance,
    late_deduction,
    total_deductions,
    net_pay,
  };
}
