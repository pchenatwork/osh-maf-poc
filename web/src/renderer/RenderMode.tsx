import type { ReactNode } from "react";
import type { RenderMode } from "../item-controls/contract";
import { RenderModeContext } from "./renderModeContext";

export const RenderModeProvider = ({
  mode,
  children,
}: {
  mode: RenderMode;
  children: ReactNode;
}) => (
  <RenderModeContext.Provider value={mode}>
    {children}
  </RenderModeContext.Provider>
);
