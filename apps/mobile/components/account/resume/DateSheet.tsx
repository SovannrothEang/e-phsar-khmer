import { FieldError, FloatingLabel } from "@/components/common/FloatingInput";
import { Colors } from "@/constants/Colors";
import { formatMonthYearValue, type MonthYear } from "@/lib/api/resume";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { dayOptions, MONTH_OPTIONS, yearOptions } from "./options";
import { WheelColumn, WheelSheet } from "./WheelPicker";

const pad2 = (value: number): string => String(value).padStart(2, "0");

interface FieldShellProps {
  label: string;
  display: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  onPress: () => void;
  onClear?: () => void;
}

/** Filled field surface shared by the date and month pickers. */
function FieldShell({
  label,
  display,
  required = false,
  disabled = false,
  error,
  onPress,
  onClear,
}: FieldShellProps) {
  const border = error ? "border border-red-400" : "border border-transparent";

  return (
    <View>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
        className={`h-14 flex-row items-center justify-end rounded-lg px-4 ${
          disabled
            ? "bg-[#F2F2F7] opacity-60 dark:bg-[#2C2C2E]"
            : "bg-[#F2F2F7] dark:bg-[#3A3A3C]"
        } ${border}`}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <FloatingLabel label={label} active={!!display} required={required} />
        {display ? (
          <Text
            className="text-base text-gray-900 dark:text-white"
            style={{ position: "absolute", left: 16, right: 44, top: 24 }}
            numberOfLines={1}
          >
            {display}
          </Text>
        ) : null}
        {display && onClear && !disabled ? (
          <TouchableOpacity
            onPress={onClear}
            className="h-6 w-6 items-center justify-center rounded-full"
            style={{ backgroundColor: Colors.danger }}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
          >
            <Ionicons name="close" size={14} color="white" />
          </TouchableOpacity>
        ) : (
          <Ionicons
            name="chevron-down"
            size={20}
            color={disabled ? "#D1D5DB" : Colors.text.muted}
          />
        )}
      </TouchableOpacity>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

/** Year → month wheels; the reference places Cancel/Done in a bottom bar. */
function MonthYearWheelSheet({
  visible,
  value,
  onDone,
  onClose,
}: {
  visible: boolean;
  value: MonthYear | null;
  onDone: (value: MonthYear) => void;
  onClose: () => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(value?.year ?? now.getFullYear());
  const [month, setMonth] = useState(value?.month ?? now.getMonth() + 1);
  const [prevInit, setPrevInit] = useState({
    visible,
    year: value?.year,
    month: value?.month,
  });

  // Re-seed the wheels from the committed value every time the sheet opens.
  // Adjusting state during render is the supported pattern; an effect caused
  // cascading renders.
  if (
    prevInit.visible !== visible ||
    prevInit.year !== value?.year ||
    prevInit.month !== value?.month
  ) {
    setPrevInit({ visible, year: value?.year, month: value?.month });
    if (visible) {
      const current = new Date();
      setYear(value?.year ?? current.getFullYear());
      setMonth(value?.month ?? current.getMonth() + 1);
    }
  }

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const years = yearOptions();
  const months = MONTH_OPTIONS.filter(
    (option) => year !== currentYear || Number(option.id) <= currentMonth,
  );
  const safeMonth = months.some((option) => Number(option.id) === month)
    ? month
    : Number(months[months.length - 1]?.id ?? 1);

  return (
    <WheelSheet
      visible={visible}
      onCancel={onClose}
      onDone={() => onDone({ year, month: safeMonth })}
      toolbarPosition="bottom"
    >
      <WheelColumn
        options={years}
        value={String(year)}
        onChange={(next) => setYear(Number(next))}
      />
      <WheelColumn
        options={months}
        value={String(safeMonth)}
        onChange={(next) => setMonth(Number(next))}
      />
    </WheelSheet>
  );
}

/** Year → month → day wheels; the reference uses the top Cancel/Done bar. */
function DobWheelSheet({
  visible,
  value,
  onDone,
  onClose,
}: {
  visible: boolean;
  value: string | null;
  onDone: (value: string) => void;
  onClose: () => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(value ? Number(value.slice(0, 4)) : 2000);
  const [month, setMonth] = useState(value ? Number(value.slice(5, 7)) : 1);
  const [day, setDay] = useState(value ? value.slice(8, 10) : "01");
  const [prevValue, setPrevValue] = useState({ visible, value });

  // Re-seed the wheels from the committed value every time the sheet opens.
  // Adjusting state during render is the supported pattern; an effect caused
  // cascading renders.
  if (prevValue.visible !== visible || prevValue.value !== value) {
    setPrevValue({ visible, value });
    if (visible) {
      setYear(value ? Number(value.slice(0, 4)) : 2000);
      setMonth(value ? Number(value.slice(5, 7)) : 1);
      setDay(value ? value.slice(8, 10) : "01");
    }
  }

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const years = yearOptions();
  const months = MONTH_OPTIONS.filter(
    (option) => year !== currentYear || Number(option.id) <= currentMonth,
  );
  const safeMonth = months.some((option) => Number(option.id) === month)
    ? month
    : Number(months[months.length - 1]?.id ?? 1);
  const days = dayOptions(year, safeMonth).filter(
    (option) =>
      year !== currentYear ||
      safeMonth !== currentMonth ||
      Number(option.id) <= currentDay,
  );
  const safeDay = days.some((option) => option.id === day)
    ? day
    : (days[days.length - 1]?.id ?? "01");

  return (
    <WheelSheet
      visible={visible}
      onCancel={onClose}
      onDone={() => onDone(`${year}-${pad2(safeMonth)}-${safeDay}`)}
      toolbarPosition="top"
    >
      <WheelColumn
        options={years}
        value={String(year)}
        onChange={(next) => setYear(Number(next))}
      />
      <WheelColumn
        options={months}
        value={String(safeMonth)}
        onChange={(next) => setMonth(Number(next))}
      />
      <WheelColumn
        options={days}
        value={safeDay}
        onChange={(next) => setDay(next)}
      />
    </WheelSheet>
  );
}

/** Month-year field used by Experience and Education. */
export function MonthYearField({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  disabledText,
  error,
}: {
  label: string;
  value: MonthYear | null;
  onChange: (value: MonthYear | null) => void;
  required?: boolean;
  disabled?: boolean;
  /** Shown instead of a value when the field is disabled (e.g. "Present"). */
  disabledText?: string;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);
  const display = disabled ? (disabledText ?? "") : formatMonthYearValue(value);

  return (
    <>
      <FieldShell
        label={label}
        display={display}
        required={required}
        disabled={disabled}
        error={error}
        onPress={() => setVisible(true)}
        onClear={value ? () => onChange(null) : undefined}
      />
      <MonthYearWheelSheet
        visible={visible}
        value={value}
        onDone={(next) => {
          onChange(next);
          setVisible(false);
        }}
        onClose={() => setVisible(false)}
      />
    </>
  );
}

/** Date of birth field (year → month → day wheels). */
export function DobField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <FieldShell
        label={label}
        display={value ?? ""}
        onPress={() => setVisible(true)}
        onClear={value ? () => onChange(null) : undefined}
        error={error}
      />
      <DobWheelSheet
        visible={visible}
        value={value}
        onDone={(next) => {
          onChange(next);
          setVisible(false);
        }}
        onClose={() => setVisible(false)}
      />
    </>
  );
}
