import { createContext, useContext } from "react";
import type { RenderMode } from "../item-controls/contract";

/**
 * Kept apart from RenderMode.tsx so that file exports only its component —
 * react-refresh cannot hot-reload a module mixing components and hooks.
 */
export const RenderModeContext = createContext<RenderMode>("edit");

export const useRenderMode = () => useContext(RenderModeContext);
