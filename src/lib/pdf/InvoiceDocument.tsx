import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { COMPANY_INFO } from "@/lib/company-info";
import { formatMoney } from "@/lib/money";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0b0e1a" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  companyName: { fontSize: 13, fontWeight: 700, marginBottom: 4 },
  muted: { color: "#4a5164", fontSize: 9, lineHeight: 1.5 },
  invoiceTitle: { fontSize: 20, fontWeight: 700, textAlign: "right" },
  statusBadge: { fontSize: 9, textAlign: "right", marginTop: 4, textTransform: "uppercase", letterSpacing: 1 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24, paddingBottom: 16, borderBottom: "1 solid #e2e6ed" },
  metaBlock: { flexDirection: "column" },
  metaLabel: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: "#4a5164", marginBottom: 3 },
  table: { marginTop: 8 },
  tableHeaderRow: { flexDirection: "row", borderBottom: "1 solid #0b0e1a", paddingBottom: 6, marginBottom: 6 },
  tableRow: { flexDirection: "row", borderBottom: "0.5 solid #e2e6ed", paddingVertical: 6 },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1, textAlign: "right" },
  colVat: { flex: 1, textAlign: "right" },
  colTotal: { flex: 1.2, textAlign: "right" },
  thText: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: "#4a5164" },
  totalsBlock: { marginTop: 16, alignSelf: "flex-end", width: 220 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsRowFinal: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8, marginTop: 4, borderTop: "1 solid #0b0e1a" },
  totalsLabelFinal: { fontSize: 11, fontWeight: 700 },
  totalsValueFinal: { fontSize: 11, fontWeight: 700 },
  notes: { marginTop: 28, fontSize: 9, color: "#4a5164", lineHeight: 1.5 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#8a92a3", textAlign: "center" },
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Awaiting Payment",
  paid: "Paid",
  cancelled: "Cancelled",
};

type InvoiceItem = { description: string; quantity: string; unitPrice: string; vatRate: string; lineTotal: string };
type Invoice = {
  invoiceNo: string;
  date: string;
  dueDate: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddr: string | null;
  notes: string | null;
  baseAmount: string;
  vatAmount: string;
  totalAmount: string;
  status: string;
  items: InvoiceItem[];
};

export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  return (
    <Document title={invoice.invoiceNo}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{COMPANY_INFO.legalName}</Text>
            <Text style={styles.muted}>{COMPANY_INFO.addressLine1}</Text>
            <Text style={styles.muted}>{COMPANY_INFO.addressLine2}</Text>
            <Text style={styles.muted}>TRN: {COMPANY_INFO.trn}</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
            <Text style={styles.statusBadge}>{STATUS_LABEL[invoice.status] ?? invoice.status}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Bill To</Text>
            <Text style={{ fontWeight: 700, marginBottom: 2 }}>{invoice.clientName}</Text>
            {!!invoice.clientAddr && <Text style={styles.muted}>{invoice.clientAddr}</Text>}
            {!!invoice.clientEmail && <Text style={styles.muted}>{invoice.clientEmail}</Text>}
            {!!invoice.clientPhone && <Text style={styles.muted}>{invoice.clientPhone}</Text>}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Invoice No.</Text>
            <Text style={{ marginBottom: 8 }}>{invoice.invoiceNo}</Text>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={{ marginBottom: 8 }}>{invoice.date}</Text>
            {!!invoice.dueDate && (
              <>
                <Text style={styles.metaLabel}>Due Date</Text>
                <Text>{invoice.dueDate}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colDesc, styles.thText]}>Description</Text>
            <Text style={[styles.colQty, styles.thText]}>Qty</Text>
            <Text style={[styles.colPrice, styles.thText]}>Unit Price</Text>
            <Text style={[styles.colVat, styles.thText]}>VAT</Text>
            <Text style={[styles.colTotal, styles.thText]}>Amount</Text>
          </View>
          {invoice.items.map((item, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{formatMoney(item.unitPrice)}</Text>
              <Text style={styles.colVat}>{(Number(item.vatRate) * 100).toFixed(0)}%</Text>
              <Text style={styles.colTotal}>{formatMoney(item.lineTotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text>{formatMoney(invoice.baseAmount)} AED</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.muted}>VAT</Text>
            <Text>{formatMoney(invoice.vatAmount)} AED</Text>
          </View>
          <View style={styles.totalsRowFinal}>
            <Text style={styles.totalsLabelFinal}>Total Due</Text>
            <Text style={styles.totalsValueFinal}>{formatMoney(invoice.totalAmount)} AED</Text>
          </View>
        </View>

        {!!invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.metaLabel}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          {COMPANY_INFO.phone} · {COMPANY_INFO.email}
        </Text>
      </Page>
    </Document>
  );
}
