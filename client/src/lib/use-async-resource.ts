"use client";

import { useEffect, useState, type DependencyList } from "react";

type AsyncResourceState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load EduFX data.";
}

export function useAsyncResource<T>(
  loader: () => Promise<T | null>,
  deps: DependencyList
): AsyncResourceState<T> {
  const [state, setState] = useState<AsyncResourceState<T>>({
    data: null,
    error: null,
    loading: true
  });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, error: null, loading: true }));

    void loader()
      .then((data) => {
        if (active) {
          setState({ data, error: null, loading: false });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({ data: null, error: toErrorMessage(error), loading: false });
        }
      });

    return () => {
      active = false;
    };
  }, deps);

  return state;
}
