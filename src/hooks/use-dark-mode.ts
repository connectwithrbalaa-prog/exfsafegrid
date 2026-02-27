import { useState, useEffect } from "react";

export function useDarkMode() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const toggle = () => setDark((d) => !d);

  return { dark, setDark, toggle };
}
