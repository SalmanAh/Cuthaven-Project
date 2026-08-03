#!/bin/bash
# Build consolidated SQL file

OUTPUT="CONSOLIDATED_DATABASE_SCHEMA.sql"

# Header
cat > "$OUTPUT" << 'HEADER'
-- ═══════════════════════════════════════════════════════════════════════════
-- CUTHAVEN DATABASE SCHEMA - CONSOLIDATED FOR ANALYSIS
-- Generated: July 30, 2026
-- Purpose: Complete database schema with all migrations in proper sequence
-- ═══════════════════════════════════════════════════════════════════════════

HEADER

# Add each SQL file in order
echo "" >> "$OUTPUT"
echo "-- ═══════════════════════════════════════════════════════════════════════════" >> "$OUTPUT"
echo "-- SECTION 1: BASE SCHEMA (All 16 Tables)" >> "$OUTPUT"
echo "-- File: cuthaven_db_schema.sql" >> "$OUTPUT"
echo "-- ═══════════════════════════════════════════════════════════════════════════" >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat cuthaven_db_schema.sql >> "$OUTPUT"

echo "" >> "$OUTPUT"
echo "-- ═══════════════════════════════════════════════════════════════════════════" >> "$OUTPUT"
echo "-- SECTION 2: MIGRATION 001 - Atomic Coupon Usage Function" >> "$OUTPUT"
echo "-- File: supabase/migrations/001_increment_coupon_usage.sql" >> "$OUTPUT"
echo "-- ═══════════════════════════════════════════════════════════════════════════" >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat supabase/migrations/001_increment_coupon_usage.sql >> "$OUTPUT"

echo "" >> "$OUTPUT"
echo "-- ═══════════════════════════════════════════════════════════════════════════" >> "$OUTPUT"
echo "-- SECTION 3: MIGRATION 002 - Row Level Security Policies" >> "$OUTPUT"
echo "-- File: supabase/migrations/002_rls_policies.sql" >> "$OUTPUT"
echo "-- ═══════════════════════════════════════════════════════════════════════════" >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat supabase/migrations/002_rls_policies.sql >> "$OUTPUT"

echo "" >> "$OUTPUT"
echo "-- ═══════════════════════════════════════════════════════════════════════════" >> "$OUTPUT"
echo "-- SECTION 4: MIGRATION 003 - Blog System" >> "$OUTPUT"
echo "-- File: supabase/migrations/003_blog_posts.sql" >> "$OUTPUT"
echo "-- ═══════════════════════════════════════════════════════════════════════════" >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat supabase/migrations/003_blog_posts.sql >> "$OUTPUT"

echo "" >> "$OUTPUT"
echo "-- ═══════════════════════════════════════════════════════════════════════════" >> "$OUTPUT"
echo "-- SECTION 5: MIGRATION 004 - Storage Bucket Policies" >> "$OUTPUT"
echo "-- File: supabase/migrations/004_storage_bucket_policy.sql" >> "$OUTPUT"
echo "-- ═══════════════════════════════════════════════════════════════════════════" >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat supabase/migrations/004_storage_bucket_policy.sql >> "$OUTPUT"

echo "" >> "$OUTPUT"
echo "-- ═══════════════════════════════════════════════════════════════════════════" >> "$OUTPUT"
echo "-- SECTION 6: MIGRATION 005 - Product Manager Role" >> "$OUTPUT"
echo "-- File: supabase/migrations/005_add_product_manager_role.sql" >> "$OUTPUT"
echo "-- ═══════════════════════════════════════════════════════════════════════════" >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat supabase/migrations/005_add_product_manager_role.sql >> "$OUTPUT"

echo "Done! Created $OUTPUT"
