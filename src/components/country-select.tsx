"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { countryName, countryOptions, countrySearchText, isCountryCode } from "@/lib/countries";
import { useI18n } from "@/lib/i18n";
import styles from "./country-select.module.css";

type PickerProps = {
  name: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
};

function CountryPicker({ name, label, values, onChange, multiple = false, disabled = false, required = false }: PickerProps) {
  const { language, t } = useI18n();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = [...new Set(values)].filter(isCountryCode);
  const options = useMemo(() => countryOptions(language), [language]);
  const results = options.filter((option) => countrySearchText(`${option.name} ${option.code}`).includes(countrySearchText(query.trim())));
  const expanded = open && !disabled;

  useEffect(() => {
    if (expanded) search.current?.focus();
  }, [expanded]);

  function close(restoreFocus = true) {
    setOpen(false);
    setQuery("");
    if (restoreFocus) trigger.current?.focus();
  }
  function choose(code: string) {
    onChange(multiple ? selected.includes(code) ? selected.filter((item) => item !== code) : [...selected, code] : [code]);
    if (!multiple) close();
  }
  function keyboard(event: KeyboardEvent) {
    if (event.key === "Escape" && expanded) {
      event.preventDefault(); event.stopPropagation(); close(); return;
    }
    if (!expanded || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    // Home/End retain their normal text-editing meaning in the search field.
    if (event.target === search.current && (event.key === "Home" || event.key === "End")) return;
    const buttons = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    if (!buttons.length) return;
    event.preventDefault();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
      : current < 0 ? event.key === "ArrowUp" ? buttons.length - 1 : 0
      : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  }

  return <div ref={root} className={`field ${styles.picker}`} onKeyDown={keyboard}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(false); }}>
    <label htmlFor={`${id}-trigger`}>{label}{required && <b> *</b>}</label>
    {/* Native select owns submission and required validation. Search never becomes a saved value. */}
    <select className={styles.native} tabIndex={-1} aria-hidden="true" name={name} multiple={multiple}
      value={multiple ? selected : selected[0] ?? ""} required={required} disabled={disabled}
      onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value).filter(isCountryCode))}
      onInvalid={(event) => {
        event.preventDefault();
        // A form can contain two required pickers. Open only its first invalid field.
        if (event.currentTarget.form?.querySelector(":invalid") === event.currentTarget) {
          setOpen(true); search.current?.focus();
        }
      }}>
      {!multiple && <option value="">{t("countries.select")}</option>}
      {options.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
    </select>
    <button ref={trigger} id={`${id}-trigger`} className={styles.trigger} type="button" disabled={disabled}
      aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? `${id}-list` : undefined}
      onClick={() => { if (expanded) close(); else setOpen(true); }}>
      <span>{multiple ? selected.length === 1 ? countryName(selected[0], language) : selected.length ? t("countries.count", { count: selected.length }) : t("countries.select")
        : selected.length ? countryName(selected[0], language) : t("countries.select")}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {multiple && selected.length > 0 && <div className={styles.chips}>
      {selected.map((code) => <span className={styles.chip} key={code}>{countryName(code, language)}
        <button type="button" disabled={disabled} aria-label={t("countries.remove", { name: countryName(code, language) })}
          onClick={() => { onChange(selected.filter((item) => item !== code)); trigger.current?.focus(); }}><X size={14} aria-hidden="true" /></button>
      </span>)}
    </div>}
    {expanded && <div className={styles.dropdown}>
      <label className="sr-only" htmlFor={`${id}-search`}>{t("countries.search")}</label>
      <input ref={search} id={`${id}-search`} type="search" autoComplete="off" placeholder={t("countries.search")}
        value={query} onChange={(event) => setQuery(event.target.value)} aria-controls={`${id}-list`} />
      <div id={`${id}-list`} className={styles.options} role="listbox" aria-label={label} aria-multiselectable={multiple || undefined}>
        {results.map((option, index) => <button type="button" key={option.code} role="option" aria-selected={selected.includes(option.code)}
          tabIndex={index === 0 ? 0 : -1} onClick={() => choose(option.code)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault(); choose(option.code);
            }
          }}>
          <span>{option.name}</span>{selected.includes(option.code) && <Check size={16} aria-hidden="true" />}
        </button>)}
      </div>
      {results.length === 0 && <p role="status">{t("countries.noResults")}</p>}
      <button className={styles.close} type="button" onClick={() => close()}>{t("countries.close")}</button>
    </div>}
  </div>;
}

type CountrySelectProps = Omit<PickerProps, "values" | "onChange" | "multiple"> & { value: string; onChange: (value: string) => void };
export function CountrySelect({ value, onChange, ...props }: CountrySelectProps) {
  return <CountryPicker {...props} values={value ? [value] : []} onChange={(values) => onChange(values[0] ?? "")} />;
}
export function CountryMultiSelect(props: Omit<PickerProps, "multiple">) {
  return <CountryPicker {...props} multiple />;
}
