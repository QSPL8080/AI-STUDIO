export const IND_CONTACT_SOURCE = "IND - Contact Form";
export const IND_POPUP_SOURCE = "IND - Popup Modal";

export type IndiaLeadSource = typeof IND_CONTACT_SOURCE | typeof IND_POPUP_SOURCE;

/** Map this site's legacy labels to India sources. Leave USA (and other) labels unchanged. */
export function displayLeadSource(source: string): string {
  if (
    source === "Contact Form" ||
    source === "IND Contact" ||
    source === IND_CONTACT_SOURCE
  ) {
    return IND_CONTACT_SOURCE;
  }
  if (
    source === "Popup Modal" ||
    source === "IND Popup" ||
    source === "IND - Popup Form" ||
    source === IND_POPUP_SOURCE
  ) {
    return IND_POPUP_SOURCE;
  }
  return source;
}

export function isIndContactSource(source: string): boolean {
  return displayLeadSource(source) === IND_CONTACT_SOURCE;
}

export function isIndPopupSource(source: string): boolean {
  return displayLeadSource(source) === IND_POPUP_SOURCE;
}
