import type {
  QuestionnaireItem,
  QuestionnaireItemProps,
  QuestionnaireResponseItemAnswer,
} from "../contract";
import { errorIdOf, isEditable } from "../contract";
import { Field } from "../Field";
import shared from "../item-controls.module.css";

/**
 * The shared body of DateControl, DateTimeControl and TimeControl.
 *
 * No `Control` suffix on purpose: this is a plain helper, not something the
 * registry can resolve (Appendix E). The three controls that wrap it are the
 * registry-resolvable ones.
 *
 * It exists so the *input* is swappable. Replacing the native input with
 * react-day-picker or react-aria later is a change to this one file, not to
 * three — and the FHIR-string conversions below stay put, which is where the
 * real risk lives.
 *
 * WHY NATIVE INPUTS
 * -----------------
 * FHIR temporal types are strings, not timestamps. `valueDate` is
 * "2026-09-06" — no time, no zone. A native input's `.value` IS that string,
 * so nothing is ever parsed into a `Date` and nothing can drift.
 *
 * The drift is real and goes both ways, depending on which half of the
 * round-trip you get wrong (both verified, see the note at the end):
 *
 *   new Date(2026, 8, 6).toISOString().slice(0, 10)  // "2026-09-05" EAST of UTC
 *   new Date("2026-09-06").getDate()                 // the 5th, WEST of UTC
 *
 * The first is what a picker hands you: a Date at *local* midnight, which is
 * the previous day in UTC once you are east of Greenwich. The second is the
 * return trip — a date-only string parses as *UTC* midnight, so reading local
 * calendar parts off it loses a day going the other way. A date of birth that
 * shifts by timezone is a patient-matching bug, and it reproduces in
 * Asia/Kolkata and America/New_York respectively.
 *
 * Every library can be used correctly. Native is correct by construction,
 * because no `Date` is ever built.
 *
 * The browser's own control also carries keyboard and screen-reader support
 * we would otherwise owe §11, and `minValue`/`maxValue` map straight onto the
 * `min`/`max` attributes with no conversion at all.
 */

export type TemporalKind = "date" | "dateTime" | "time";

const MIN_VALUE = "http://hl7.org/fhir/StructureDefinition/minValue";
const MAX_VALUE = "http://hl7.org/fhir/StructureDefinition/maxValue";

/**
 * Each kind's three differences: the input type, how to read the answer, and
 * how to turn an input value back into a valid FHIR string.
 *
 * The `toFhir` step is not ceremony. A native input's value is *nearly* the
 * FHIR string, and the gaps are exactly where invalid resources get written:
 *
 *   time            input gives "14:30"             FHIR requires seconds
 *   dateTime        input gives "2026-09-06T14:30"  FHIR requires seconds AND,
 *                                                   once hours are present, a
 *                                                   timezone offset
 */
const KINDS: Record<
  TemporalKind,
  {
    inputType: "date" | "datetime-local" | "time";
    /** Does the native input know how to display this stored value? */
    canRender: (v: string) => boolean;
    read: (a: QuestionnaireResponseItemAnswer | undefined) => string;
    /** Stored FHIR string -> what the input wants in its value attribute. */
    toInput: (v: string) => string;
    /** Input value -> a valid FHIR string. */
    toFhir: (v: string) => string;
    write: (v: string) => QuestionnaireResponseItemAnswer;
    bound: (item: QuestionnaireItem, url: string) => string | undefined;
  }
> = {
  date: {
    inputType: "date",
    // FHIR permits partial dates ("2026", "2026-09"); type="date" cannot show
    // them. See the fallback in the component.
    canRender: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
    read: (a) => a?.valueDate ?? "",
    toInput: (v) => v,
    toFhir: (v) => v,
    write: (v) => ({ valueDate: v }),
    bound: (item, url) =>
      item.extension?.find((e) => e.url === url)?.valueDate,
  },

  dateTime: {
    inputType: "datetime-local",
    canRender: (v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v),
    read: (a) => a?.valueDateTime ?? "",
    // Show the wall-clock time as recorded rather than converting it into the
    // viewer's zone: a signed order must read back the way it was signed.
    toInput: (v) => v.slice(0, 16),
    toFhir: (v) => `${v}:00${offsetOf(v)}`,
    write: (v) => ({ valueDateTime: v }),
    bound: (item, url) =>
      item.extension?.find((e) => e.url === url)?.valueDateTime?.slice(0, 16),
  },

  time: {
    inputType: "time",
    canRender: (v) => /^\d{2}:\d{2}/.test(v),
    read: (a) => a?.valueTime ?? "",
    toInput: (v) => v.slice(0, 5),
    toFhir: (v) => (v.length === 5 ? `${v}:00` : v),
    write: (v) => ({ valueTime: v }),
    bound: (item, url) =>
      item.extension?.find((e) => e.url === url)?.valueTime?.slice(0, 5),
  },
};

/**
 * The UTC offset in effect at that local instant, as "+HH:mm".
 *
 * Computed from the entered value rather than from `new Date()` so it is
 * correct across a DST boundary — an order written in January and one written
 * in July do not share an offset. A datetime string with no offset is parsed
 * as local time by ES2015+, which is what makes this read correct.
 */
function offsetOf(localValue: string): string {
  const minutes = -new Date(localValue).getTimezoneOffset();
  if (Number.isNaN(minutes)) return "Z";
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

interface Props extends QuestionnaireItemProps {
  kind: TemporalKind;
}

export const TemporalField = ({
  item,
  answers,
  setAnswers,
  errors,
  mode,
  kind,
}: Props) => {
  const spec = KINDS[kind];
  const stored = spec.read(answers[0]);
  const id = `q-${item.linkId}`;

  if (!isEditable(mode)) {
    return (
      <Field item={item} id={id} errors={[]}>
        <span className={shared.value}>{stored || "—"}</span>
      </Field>
    );
  }

  // A stored value the native control cannot display would be wiped the
  // moment the user touched the field. Fall back to a text input so the value
  // stays visible and editable instead of silently vanishing. In practice
  // this fires only on partial FHIR dates.
  const degraded = stored !== "" && !spec.canRender(stored);

  return (
    <Field item={item} id={id} errors={errors} htmlFor={id}>
      <input
        id={id}
        type={degraded ? "text" : spec.inputType}
        value={degraded ? stored : spec.toInput(stored)}
        min={degraded ? undefined : spec.bound(item, MIN_VALUE)}
        max={degraded ? undefined : spec.bound(item, MAX_VALUE)}
        aria-required={item.required || undefined}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={errors.length ? errorIdOf(id) : undefined}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return setAnswers([]);
          setAnswers([spec.write(degraded ? v : spec.toFhir(v))]);
        }}
      />
    </Field>
  );
};
