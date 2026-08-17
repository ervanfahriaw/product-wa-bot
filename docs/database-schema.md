# Skema database (SQLite)

Semua tabel dalam satu file `data/bot.db`.

## `settings`
| kolom | tipe | keterangan |
|---|---|---|
| key | TEXT PK | contoh: "mode", "gemini_api_key", "grok_api_key", "business_name" |
| value | TEXT | disimpan sebagai string/JSON |

## `products` (Mode Bisnis)
| kolom | tipe | keterangan |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | |
| description | TEXT | |
| price | INTEGER | |
| stock | INTEGER | |
| image_path | TEXT | path lokal gambar produk |
| updated_at | DATETIME | |

## `expenses` (Mode Personal)
| kolom | tipe | keterangan |
|---|---|---|
| id | INTEGER PK | |
| category | TEXT | contoh: makan, transport, dll |
| amount | INTEGER | |
| note | TEXT | teks asli dari user, buat referensi |
| created_at | DATETIME | |

## `reminders`
| kolom | tipe | keterangan |
|---|---|---|
| id | INTEGER PK | |
| message | TEXT | |
| trigger_at | DATETIME | |
| is_recurring | BOOLEAN | |
| cron_pattern | TEXT | null kalau bukan recurring |
| sent | BOOLEAN | |

## `chat_logs`
| kolom | tipe | keterangan |
|---|---|---|
| id | INTEGER PK | |
| contact | TEXT | nomor WA lawan bicara |
| message_in | TEXT | |
| message_out | TEXT | |
| handled_by | TEXT | "ai" atau "human" |
| created_at | DATETIME | |

Catatan: skema ini draft awal v1, boleh berkembang. Kalau ada perubahan, update dokumen ini juga (bukan cuma migration file) supaya tetap jadi sumber kebenaran untuk agent.
