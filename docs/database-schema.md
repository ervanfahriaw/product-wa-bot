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
| label | TEXT | label untuk identifikasi/pencarian, auto-generated dari message |
| recurrence_type | TEXT | 'daily', 'weekly', 'monthly', atau NULL |
| snoozed_until | DATETIME | null kalau tidak di-snooze |
| is_active | INTEGER | 1 = aktif, 0 = dibatalkan |

## `notes` (Mode Personal)
| kolom | tipe | keterangan |
|---|---|---|
| id | INTEGER PK | |
| title | TEXT | judul opsional |
| content | TEXT | isi catatan |
| tags | TEXT | comma-separated tags untuk pencarian |
| created_at | DATETIME | |
| updated_at | DATETIME | |

## `todos` (Mode Personal)
| kolom | tipe | keterangan |
|---|---|---|
| id | INTEGER PK | |
| task | TEXT | nama tugas |
| priority | TEXT | 'urgent', 'normal', 'low' |
| is_done | INTEGER | 0 = belum, 1 = selesai |
| due_date | DATETIME | deadline opsional |
| completed_at | DATETIME | waktu diselesaikan |
| created_at | DATETIME | |

## `budgets` (Mode Personal)
| kolom | tipe | keterangan |
|---|---|---|
| id | INTEGER PK | |
| category | TEXT UNIQUE | nama kategori pengeluaran |
| monthly_limit | INTEGER | batas anggaran bulanan (Rp) |
| alert_at_percent | INTEGER | threshold peringatan (default 80%) |
| is_active | INTEGER | 1 = aktif, 0 = nonaktif |
| created_at | DATETIME | |
| updated_at | DATETIME | |

## `habits` (Mode Personal)
| kolom | tipe | keterangan |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | nama kebiasaan |
| frequency | TEXT | 'daily' / 'weekly' |
| target_per_period | INTEGER | target per periode |
| streak_current | INTEGER | streak saat ini |
| streak_best | INTEGER | best streak sepanjang waktu |
| is_active | INTEGER | 1 = aktif |
| created_at | DATETIME | |

## `habit_logs` (Mode Personal)
| kolom | tipe | keterangan |
|---|---|---|
| id | INTEGER PK | |
| habit_id | INTEGER FK | referensi ke habits.id |
| logged_at | DATETIME | waktu check-in |
| note | TEXT | catatan opsional |

## `events` (Mode Personal)
| kolom | tipe | keterangan |
|---|---|---|
| id | INTEGER PK | |
| title | TEXT | judul acara |
| description | TEXT | deskripsi opsional |
| event_date | DATETIME | waktu acara |
| event_end | DATETIME | waktu selesai (opsional) |
| location | TEXT | lokasi acara |
| remind_before_minutes | INTEGER | menit sebelum reminder (default 30) |
| is_notified | INTEGER | 0 = belum, 1 = sudah |
| created_at | DATETIME | |

## `journals` (Mode Personal)
| kolom | tipe | keterangan |
|---|---|---|
| id | INTEGER PK | |
| content | TEXT | isi jurnal |
| mood | TEXT | senang/biasa/sedih/marah/cemas/bersyukur |
| tags | TEXT | tag comma-separated |
| journal_date | DATE | tanggal jurnal |
| created_at | DATETIME | |

## `goals` (Mode Personal)
| kolom | tipe | keterangan |
|---|---|---|
| id | INTEGER PK | |
| title | TEXT | judul goal |
| target_value | INTEGER | target angka |
| current_value | INTEGER | progress saat ini |
| unit | TEXT | satuan (rupiah, buku, dll) |
| deadline | DATE | batas waktu |
| status | TEXT | 'active' / 'completed' |
| created_at | DATETIME | |
| completed_at | DATETIME | waktu tercapai |

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
