ALTER TABLE "inventory_movements" ALTER COLUMN "movement_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."movement_type";--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('receipt', 'consumption', 'production');--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "movement_type" SET DATA TYPE "public"."movement_type" USING "movement_type"::"public"."movement_type";--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "unit" SET DATA TYPE varchar(30);--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "unit" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "unit_price" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "opening_stock" numeric(12, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "closing_stock" numeric(12, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "unit_price" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "total_price" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "vat_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "grand_total" numeric(12, 2) DEFAULT '0' NOT NULL;