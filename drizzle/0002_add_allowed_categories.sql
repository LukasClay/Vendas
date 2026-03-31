ALTER TABLE "products" ADD COLUMN "allowedCategories" jsonb DEFAULT '["individual","promocao","coletivo"]' NOT NULL;
