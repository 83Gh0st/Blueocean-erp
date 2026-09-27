import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { COMPANY_INFO } from "@/lib/company-info";
import { formatMoney } from "@/lib/money";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0b0e1a" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  companyName: { fontSize: 13, fontWeight: 700, marginBottom: 4 },
  muted: { color: "#4a5164", fontSize: 9, lineHeight: 1.5 },
  title: { fontSize: 20, fontWeight: 700, textAlign: "right" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24, paddingBottom: 16, borderBottom: "1 solid #e2e6ed" },
  metaBlock: { flexDirection: "column" },
  metaLabel: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: "#4a5164", marginBottom: 3 },
  table: { marginTop: 8 },
  tableHeaderRow: { flexDirection: "row", borderBottom: "1 solid #0b0e1a", paddingBottom: 6, marginBottom: 6 },
  tableRow: { flexDirection: "row", borderBottom: "0.5 solid #e2e6ed", paddingVertical: 6 },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1, textAlign: "right" },
  colTotal: { flex: 1.2, textAlign: "right" },
  thText: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: "#4a5164" },
  totalsBlock: { marginTop: 16, alignSelf: "flex-end", width: 220 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsRowFinal: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8, marginTop: 4, borderTop: "1 solid #0b0e1a" },
  totalsLabelFinal: { fontSize: 11, fontWeight: 700 },
  totalsValueFinal: { fontSize: 11, fontWeight: 700 },
  notes: { marginTop: 28, fontSize: 9, color: "#4a5164", lineHeight: 1.5 },
});

type PoItem = { description: string; quantityOrdered: string; unitPrice: string; lineTotal: string };
type Po = {
  poNumber: string;
  date: string;
  expectedDate: string | null;
  supplierName: string;
  supplierAddress: string | null;
  supplierEmail: string | null;
  supplierPhone: string | null;
  notes: string | null;
  baseAmount: string;
  vatAmount: string;
  totalAmount: string;
  items: PoItem[];
};

export function PurchaseOrderDocument({ po }: { po: Po }) {
  return (
    <Document title={po.poNumber}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{COMPANY_INFO.legalName}</Text>
            <Text style={styles.muted}>{COMPANY_INFO.addressLine1}</Text>
            <Text style={styles.muted}>{COMPANY_INFO.addressLine2}</Text>
            <Text style={styles.muted}>TRN: {COMPANY_INFO.trn}</Text>
          </View>
          <Text style={styles.title}>PURCHASE ORDER</Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Supplier</Text>
            <Text style={{ fontWeight: 700, marginBottom: 2 }}>{po.supplierName}</Text>
            {!!po.supplierAddress && <Text style={styles.muted}>{po.supplierAddress}</Text>}
            {!!po.supplierEmail && <Text style={styles.muted}>{po.supplierEmail}</Text>}
            {!!po.supplierPhone && <Text style={styles.muted}>{po.supplierPhone}</Text>}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>PO Number</Text>
            <Text style={{ marginBottom: 8 }}>{po.poNumber}</Text>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={{ marginBottom: 8 }}>{po.date}</Text>
            {!!po.expectedDate && (
              <>
                <Text style={styles.metaLabel}>Expected Delivery</Text>
                <Text>{po.expectedDate}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colDesc, styles.thText]}>Description</Text>
            <Text style={[styles.colQty, styles.thText]}>Qty</Text>
            <Text style={[styles.colPrice, styles.thText]}>Unit Price</Text>
            <Text style={[styles.colTotal, styles.thText]}>Amount</Text>
          </View>
          {po.items.map((item, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantityOrdered}</Text>
              <Text style={styles.colPrice}>{formatMoney(item.unitPrice)}</Text>
              <Text style={styles.colTotal}>{formatMoney(item.lineTotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text>{formatMoney(po.baseAmount)} AED</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.muted}>VAT</Text>
            <Text>{formatMoney(po.vatAmount)} AED</Text>
          </View>
          <View style={styles.totalsRowFinal}>
            <Text style={styles.totalsLabelFinal}>Total</Text>
            <Text style={styles.totalsValueFinal}>{formatMoney(po.totalAmount)} AED</Text>
          </View>
        </View>

        {!!po.notes && (
          <View style={styles.notes}>
            <Text style={styles.metaLabel}>Notes</Text>
            <Text>{po.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
