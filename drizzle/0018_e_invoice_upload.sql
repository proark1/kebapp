ALTER TABLE "incoming_invoices" ADD COLUMN "e_invoice_xml" text;--> statement-breakpoint
ALTER TABLE "incoming_invoices" ADD COLUMN "source_file_name" varchar(255);