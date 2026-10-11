import PDFDocument from "pdfkit";
import type { Order, OrderItem } from "@prisma/client";

type InvoiceItem = OrderItem & { product: { name: string }; retailer: { name: string } };
type InvoiceOrder = Order & { items: InvoiceItem[] };

/** Renders a simple, real invoice PDF for an order — line items, totals, shipping address. Returns a Buffer so the controller can stream it with a Content-Disposition header. */
export function renderInvoicePdf(order: InvoiceOrder): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("Kaushaya", { continued: true }).fontSize(10).text("  Handloom Saree Marketplace", { align: "left" });
    doc.moveDown(1.5);

    doc.fontSize(14).text(`Invoice — Order #${order.orderNumber}`);
    doc.fontSize(10).fillColor("#555").text(`Placed on ${order.placedAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`);
    doc.fillColor("#000");
    doc.moveDown();

    const address = order.shippingAddress as { fullName: string; line1: string; city: string; state: string; postalCode: string; phone: string };
    doc.fontSize(11).text("Shipping Address", { underline: true });
    doc.fontSize(10).text(address.fullName);
    doc.text(address.line1);
    doc.text(`${address.city}, ${address.state} ${address.postalCode}`);
    doc.text(address.phone);
    doc.moveDown();

    doc.fontSize(11).text("Items", { underline: true });
    doc.moveDown(0.5);
    const tableTop = doc.y;
    doc.fontSize(10).text("Product", 50, tableTop).text("Retailer", 260, tableTop).text("Qty", 380, tableTop).text("Amount", 450, tableTop);
    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor("#ccc").stroke();

    let y = tableTop + 22;
    for (const item of order.items) {
      const amount = Number(item.priceAtPurchase) * item.quantity;
      doc.fontSize(10).fillColor("#000").text(item.product.name, 50, y, { width: 200 });
      doc.text(item.retailer.name, 260, y, { width: 110 });
      doc.text(String(item.quantity), 380, y);
      doc.text(`Rs. ${amount.toLocaleString("en-IN")}`, 450, y);
      y += 20;
    }

    doc.moveTo(50, y + 5).lineTo(545, y + 5).strokeColor("#ccc").stroke();
    y += 15;

    const totalsRow = (label: string, value: string, bold = false) => {
      doc.fontSize(bold ? 12 : 10).text(label, 380, y).text(value, 450, y);
      y += bold ? 18 : 16;
    };
    totalsRow("Subtotal", `Rs. ${Number(order.subtotal).toLocaleString("en-IN")}`);
    totalsRow("Shipping", `Rs. ${Number(order.shipping).toLocaleString("en-IN")}`);
    totalsRow("Tax (GST 18%)", `Rs. ${Number(order.tax).toLocaleString("en-IN")}`);
    totalsRow("Total", `Rs. ${Number(order.total).toLocaleString("en-IN")}`, true);

    doc.moveDown(2);
    doc.fontSize(9).fillColor("#888").text(`Payment: ${order.paymentMethod} — ${order.paymentStatus}`, 50);

    doc.end();
  });
}
