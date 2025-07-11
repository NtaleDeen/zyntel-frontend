import os
import json
import csv
import psycopg2
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Connect to Neon (PostgreSQL)
conn = psycopg2.connect(DATABASE_URL)
cursor = conn.cursor()

DATA_JSON_PATH = "./data/data.json"
TIMEOUT_CSV_PATH = "./data/TimeOut.csv"
META_CSV_PATH = "./data/meta.csv"

# Function to parse dates robustly (shared logic)
def parse_date(value):
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(value.strip(), fmt)
        except (ValueError, AttributeError):
            continue
    return None

# Parse datetime including time
def parse_datetime(value):
    for fmt in ("%d/%m/%Y %H:%M", "%d-%m-%Y %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value.strip(), fmt)
        except (ValueError, AttributeError):
            continue
    return None

# Import meta.csv to LabTestsOverview
def import_meta():
    with open(META_CSV_PATH, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            test_name = row.get("TestName")
            tat = int(row.get("TAT") or 0)
            section = row.get("LabSection")
            price = int(row.get("Price") or 0)
            cursor.execute("""
                INSERT INTO LabTestsOverview (test_name, tat, lab_section, price)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (test_name) DO NOTHING
            """, (test_name, tat, section, price))
    conn.commit()

# Import TimeOut.csv to update LabEncounters
def import_timeout():
    df = pd.read_csv(TIMEOUT_CSV_PATH)
    for _, row in df.iterrows():
        lab_no = str(row.get("Lab_No")).strip()
        time_out = parse_datetime(row.get("Time_Out"))
        if lab_no and time_out:
            cursor.execute("""
                UPDATE LabEncounters
                SET time_out = %s
                WHERE lab_no = %s
            """, (time_out, lab_no))
    conn.commit()

# Import data.json to LabEncounters
def import_data_json():
    with open(DATA_JSON_PATH, encoding="utf-8") as f:
        records = json.load(f)
        for r in records:
            lab_no = str(r.get("LabNo") or "").strip()
            test = r.get("TestName")
            patient = r.get("Patient")
            encounter_date = parse_date(r.get("EncounterDate"))
            hospital_unit = r.get("Src")
            invoice = r.get("InvoiceNo")
            hospital_id = r.get("HospitalID") or "default"

            if lab_no and test and encounter_date:
                cursor.execute("""
                    INSERT INTO LabEncounters (lab_no, test_name, patient, encounter_date, hospital_unit, invoice_no, hospital_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (lab_no) DO NOTHING
                """, (lab_no, test, patient, encounter_date, hospital_unit, invoice, hospital_id))
    conn.commit()

# Generate progress table from LabEncounters with full date parsing
def generate_progress_table():
    cursor.execute("DELETE FROM Progress")
    cursor.execute("""
        INSERT INTO Progress (hospital_id, date, test_name, count)
        SELECT hospital_id,
               DATE_TRUNC('day', encounter_date)::date,
               test_name,
               COUNT(*) as count
        FROM LabEncounters
        WHERE encounter_date IS NOT NULL
        GROUP BY hospital_id, DATE_TRUNC('day', encounter_date), test_name
    """)
    conn.commit()

# Run all steps
import_meta()
import_data_json()
import_timeout()
generate_progress_table()

print("✅ Database updated successfully.")

cursor.close()
conn.close()
