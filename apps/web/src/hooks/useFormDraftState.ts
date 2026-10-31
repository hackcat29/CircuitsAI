"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { loadFormDraft, saveFormDraft, clearFormDraft } from "@/lib/formDraftStorage";
import { SESSION_LOGOUT_EVENT } from "@/lib/sessionCleanup";
import { useWallet } from "./useWallet";
import { useSocialSession } from "./useSocialSession";

export interface UseFormDraftStateOptions<T> {
  scope?: string | null;
  debounceMs?: number;
  onReset?: () => void;
}

export function useFormDraftState<T>(
  formKey: string,
  initialValue: T,
  options?: UseFormDraftStateOptions<T>
): [T, React.Dispatch<React.SetStateAction<T>>, () => void, boolean] {
  const { address } = useWallet();
  const { profile } = useSocialSession();
  const userScope = options?.scope !== undefined ? options.scope : (address || profile?.id || null);

  const [state, setState] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasHydratedRef = useRef(false);
  const initialValueRef = useRef(initialValue);
  initialValueRef.current = initialValue;

  const isClearingRef = useRef(false);

  // 1. Hydrate from storage on mount or when user scope changes
  useEffect(() => {
    const draft = loadFormDraft<T>(formKey, userScope);
    if (draft !== null && draft !== undefined) {
      setState(draft);
    }
    hasHydratedRef.current = true;
    setIsHydrated(true);
  }, [formKey, userScope]);

  // 2. Debounced save to storage after hydration
  useEffect(() => {
    if (!hasHydratedRef.current) return;
    if (isClearingRef.current) {
      isClearingRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      saveFormDraft(formKey, state, userScope);
    }, options?.debounceMs ?? 250);
    return () => clearTimeout(timer);
  }, [formKey, state, userScope, options?.debounceMs]);

  // 3. Clear draft helper
  const clear = useCallback(() => {
    isClearingRef.current = true;
    clearFormDraft(formKey, userScope);
    setState(initialValueRef.current);
    if (options?.onReset) options.onReset();
  }, [formKey, userScope, options]);

  // 4. Wipe on session logout event
  useEffect(() => {
    function handleLogout() {
      isClearingRef.current = true;
      clearFormDraft(formKey, userScope);
      setState(initialValueRef.current);
      if (options?.onReset) options.onReset();
    }
    window.addEventListener(SESSION_LOGOUT_EVENT, handleLogout);
    return () => window.removeEventListener(SESSION_LOGOUT_EVENT, handleLogout);
  }, [formKey, userScope, options]);

  return [state, setState, clear, isHydrated];
}
