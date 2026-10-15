import { useEffect } from "react";

/** The CRM uses a light theme while the website is dark: paint the page behind it light too
 *  (overscroll / rubber-band areas, native form controls) and restore on the way out. */
export function useLightCrmPage() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { scheme: html.style.colorScheme, htmlBg: html.style.backgroundColor, bodyBg: body.style.backgroundColor };
    html.style.colorScheme = "light";
    html.style.backgroundColor = "#f4f5f9";
    body.style.backgroundColor = "#f4f5f9";
    return () => {
      html.style.colorScheme = prev.scheme;
      html.style.backgroundColor = prev.htmlBg;
      body.style.backgroundColor = prev.bodyBg;
    };
  }, []);
}
