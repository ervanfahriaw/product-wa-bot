# Migrations Database

Folder ini digunakan untuk menyimpan file skrip migrasi SQL jika terjadi perubahan skema pada versi rilis berikutnya (v2+).

## Format Penamaan File:
Gunakan format urutan waktu / nomor versi berurutan:
- `001_add_column_x_to_products.sql`
- `002_create_table_categories.sql`

## Aturan:
1. Setiap perubahan skema tabel di migration WAJIB di-update juga di file dokumentasi `docs/database-schema.md` agar tetap sinkron.
2. Jangan melakukan `DROP TABLE` secara sembarangan yang berpotensi menghapus data pengguna saat update versi aplikasi.
