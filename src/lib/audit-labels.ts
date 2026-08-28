// Beschriftungen der Auditereignisse. Auditprotokoll und Supportakte zeigten
// dieselben Aktionen unterschiedlich - die Supportakte kannte nur fuenf davon
// und schrieb sonst SCHREIENDE_ROHNAMEN in die Oberflaeche.
export const auditActionLabels: Record<string, string> = {
  BUYING_ROUND_CREATED: "Sammelrunde angelegt",
  BUYING_ROUND_STATUS_CHANGED: "Rundenstatus geändert",
  BUYING_ROUND_TRANSITION_DENIED: "Rundenwechsel abgelehnt",
  CALCULATION_SAVED: "Kalkulation gespeichert",
  DEMAND_SUBMISSION_CONFIRMED: "Bedarf bestätigt",
  EMPLOYEE_INVITATION_ACCEPTED: "Einladung angenommen",
  EMPLOYEE_INVITATION_CREATED: "Einladung verschickt",
  EMPLOYEE_INVITATION_REVOKED: "Einladung zurückgezogen",
  E_INVOICE_IMPORTED: "E-Rechnung importiert",
  GOODS_RECEIPT_SAVED: "Wareneingang erfasst",
  GUEST_DELETED: "Gast gelöscht",
  GUEST_ORDER_RECORDED: "Gastbestellung erfasst",
  HYGIENE_ENTRY_SAVED: "Hygiene-Check gespeichert",
  INVOICE_MARKED_PAID: "Rechnung als bezahlt markiert",
  INVOICE_SAVED: "Eingangsrechnung gespeichert",
  LOYALTY_REDEEMED: "Stempelkarte eingelöst",
  ORGANIZATION_REGISTRATION_APPROVED: "Ladenantrag freigegeben",
  ORGANIZATION_REGISTRATION_REJECTED: "Ladenantrag abgelehnt",
  ORGANIZATION_SUSPENDED: "Laden pausiert",
  PLATFORM_ORDERS_IMPORTED: "Plattformbestellungen importiert",
  ROUND_AWARDED: "Zuschlag erteilt",
  SALES_IMPORTED: "Umsätze importiert",
  STOREFRONT_DOMAIN_CONNECTED: "Domain verbunden",
  STOREFRONT_DOMAIN_REJECTED: "Domain-Wunsch abgelehnt",
  SUPPORT_ASSIGNED: "Support zugewiesen",
  SUPPORT_ASSIGNMENT_ENDED: "Support beendet",
  SUPPORT_CALCULATION_SAVED: "Kalkulation gespeichert (Support)",
  SUPPORT_DEMAND_ITEM_ADDED: "Bedarfsposition ergänzt",
  SUPPORT_DEMAND_ITEM_REMOVED: "Bedarfsposition entfernt",
  SUPPORT_DEMAND_QUANTITY_UPDATED: "Bedarfsmenge geändert",
  SUPPORT_E_INVOICE_IMPORTED: "E-Rechnung importiert (Support)",
  SUPPORT_GOODS_RECEIPT_SAVED: "Wareneingang erfasst (Support)",
  SUPPORT_GUEST_ORDER_RECORDED: "Gastbestellung erfasst (Support)",
  SUPPORT_HYGIENE_ENTRY_SAVED: "Hygiene-Check gespeichert (Support)",
  SUPPORT_INVOICE_MARKED_PAID: "Rechnung bezahlt (Support)",
  SUPPORT_INVOICE_SAVED: "Rechnung gespeichert (Support)",
  SUPPORT_SALES_IMPORTED: "Umsätze importiert (Support)",
  SUPPORT_STOREFRONT_UPDATED: "Ladenwebsite geändert",
  TIME_ENTRY_CORRECTED: "Arbeitszeit korrigiert",
};

export const auditResultLabels: Record<string, string> = {
  DENIED: "Abgelehnt",
  FAILED: "Fehlgeschlagen",
  SUCCESS: "Erfolgreich",
};

export function auditActionLabel(action: string): string {
  return auditActionLabels[action] ?? action;
}

export function auditResultLabel(result: string): string {
  return auditResultLabels[result] ?? result;
}
