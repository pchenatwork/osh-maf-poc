import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { QuestionnaireResponse } from "./item-controls/contract";
import { fetchQuestionnaire } from "./api/questionnaires";
import { QuestionnaireRenderer } from "./renderer/QuestionnaireRenderer";
import { ResponseInspector } from "./renderer/ResponseInspector";
import { JsonDialog } from "./JsonDialog";
import { LoadingNotice } from "./LoadingNotice";
import type { RenderMode } from "./item-controls/contract";
import styles from "./App.module.css";

//const TOY_URL = "http://schools.nyc.gov/osh/Questionnaire/toy";
//const VERSION = "1.4";
const TOY_URL = "http://schools.nyc.gov/osh/Questionnaire/my-maf";
const VERSION = "1.0";

// 1.4 drops the flat risk panel: every line item is its own group now, the
// one shape RiskPanelControl supports. Definitions are immutable, so it is a
// new row rather than an edit — publish it before switching:
//   curl -X POST http://localhost:5080/fhir/Questionnaire \
//     -H "Content-Type: application/fhir+json" \
//     --data-binary @definitions/toy-form-1.4.json
//const VERSION = "1.3";
//const TOY_URL = "http://schools.nyc.gov/osh/Questionnaire/asthma-maf";
//const VERSION = "2026.02";

export default function App() {
  const [mode, setMode] = useState<RenderMode>("edit");
  const [live, setLive] = useState<QuestionnaireResponse | null>(null);
  const [showDefinition, setShowDefinition] = useState(false);

  const handleChange = useCallback(
    (r: QuestionnaireResponse) => setLive(r),
    [],
  );

  const {
    data: questionnaire,
    isPending,
    error,
  } = useQuery({
    queryKey: ["questionnaire", TOY_URL, VERSION],
    queryFn: () => fetchQuestionnaire(TOY_URL, VERSION),
  });

  if (isPending) return <LoadingNotice />;
  if (error)
    return <p role="alert">Could not load: {(error as Error).message}</p>;

  return (
    <>
      <div className={styles.layout}>
        <main className={styles.main}>
          {/* Page-level framing for the POC. Deliberately not a heading: the
              renderer already emits the <h1> (the form's own title), and a
              second one above it would break the document outline. */}
          <header className={styles.intro}>
            <p className={styles.warning}>
              <strong>Digital MAF — proof of concept.</strong> A runtime
              schema-driven form built on{" "}
              <strong>FHIR R4 Structured Data Capture</strong>. The form is
              data, not code: a <code>Questionnaire</code> resource is served by
              the API and rendered at runtime. Changing a form means publishing
              new JSON — not shipping a release.
            </p>
          </header>

          <div className={styles.toolbar}>
            <nav className={styles.modes}>
              {(["edit", "view"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                >
                  {m}
                </button>
              ))}
            </nav>

            {/* A command, not a mode: outside the nav, so it neither claims
                aria-pressed nor picks up the mode-switcher styling. */}
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={showDefinition}
              onClick={() => setShowDefinition(true)}
            >
              form definition
            </button>
          </div>

          <QuestionnaireRenderer
            key={questionnaire.version}
            questionnaire={questionnaire}
            mode={mode}
            onChange={handleChange}
            onSubmit={(r) => console.log("SUBMIT", r)}
          />
        </main>

        {live && <ResponseInspector response={live} />}
      </div>

      {/* Outside .layout: a modal dialog is not a grid cell. It stays mounted
          while closed (display:none) so the ref survives and the browser can
          restore focus to the trigger on close. */}
      <JsonDialog
        open={showDefinition}
        title={`Form definition — ${questionnaire.title ?? questionnaire.url} (v${questionnaire.version})`}
        value={questionnaire}
        onClose={() => setShowDefinition(false)}
      />
    </>
  );
}
