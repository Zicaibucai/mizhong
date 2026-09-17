-- Store 1688-style model/colour option groups separately from the specification table.
ALTER TABLE "Product" ADD COLUMN "variantGroups" JSONB;
