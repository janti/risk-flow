"use client";

import type { RiskRecord } from "@riskflow/risk-engine";
import { useT } from "@riskflow/ui";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { apiRequest } from "../lib/api-client";

type CommandSearchProps = {
  tenantSlug: string;
};

export function CommandSearch({ tenantSlug }: CommandSearchProps) {
  const t = useT();
  const router = useRouter();
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [items, setItems] = useState<RiskRecord[]>([]);

  const search = useCallback(
    async (value: string) => {
      if (value.trim().length < 2) {
        setItems([]);
        return;
      }
      const result = await apiRequest<{ risks: RiskRecord[] }>(
        `/api/v1/tenants/${tenantSlug}/risks?q=${encodeURIComponent(value.trim())}&limit=8`,
      );
      if (result.ok) {
        setItems(result.data.risks);
        setActive(0);
      }
    },
    [tenantSlug],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void search(query);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query, search]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const tag = target.tagName;
      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && !target.isContentEditable) {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(risk: RiskRecord) {
    setOpen(false);
    setQuery("");
    setItems([]);
    router.push(`/t/${tenantSlug}/risks/${risk.id}`);
  }

  return (
    <div className="relative mx-auto hidden w-full max-w-md md:block">
      <label htmlFor={inputId} className="sr-only">
        {t("search.label")}
      </label>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={items[active] ? `${listId}-${items[active].id}` : undefined}
        placeholder={t("search.placeholder")}
        data-testid="command-search"
        className="h-10 w-full rounded-md border bg-background py-2 pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((current) => Math.min(current + 1, Math.max(items.length - 1, 0)));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((current) => Math.max(current - 1, 0));
          }
          if (event.key === "Enter" && items[active]) {
            event.preventDefault();
            go(items[active]!);
          }
          if (event.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
      />
      {open && items.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
          data-testid="command-search-results"
        >
          {items.map((item, index) => (
            <li key={item.id} role="option" id={`${listId}-${item.id}`} aria-selected={index === active}>
              <button
                type="button"
                className={`flex w-full cursor-pointer rounded-sm px-2 py-2 text-left text-sm focus-visible:outline-none ${
                  index === active ? "bg-accent" : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => go(item)}
              >
                <span className="font-medium">{item.code}</span>
                <span className="ml-2 truncate text-muted-foreground">{item.title}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
