import psycopg2
import pandas as pd
import os
import boto3
import io
import json # Import json for handling the JSON file

# --- Database Connection ---
# The DATABASE_URL will be provided via Render's environment variables
DATABASE_URL = os.environ.get('DATABASE_URL')

# --- R2 Configuration ---
# R2 credentials will be provided via Render's environment variables
R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY')
R2_ENDPOINT_URL = os.environ.get('R2_ENDPOINT_URL') # e.g., 'https://[ACCOUNT_ID].r2.cloudflarestorage.com'
R2_BUCKET_NAME = os.environ.get('R2_BUCKET_NAME') # e.g., 'zyntel-patient-data'

# Initialize S3 client for R2
s3_client = boto3.client(
    's3',
    endpoint_url=R2_ENDPOINT_URL,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY
)

def download_file_from_r2(file_key):
    """
    Downloads a file from the R2 bucket and returns its content.
    file_key is the name of the file in the bucket (e.g., 'meta.csv').
    """
    try:
        response = s3_client.get_object(Bucket=R2_BUCKET_NAME, Key=file_key)
        file_content = response['Body'].read()
        print(f"Successfully downloaded {file_key} from R2.")
        return file_content
    except Exception as e:
        print(f"Error downloading {file_key} from R2: {e}")
        # It's important to raise the exception so the script fails if a file isn't found
        # This prevents the rest of the script from trying to process non-existent data
        raise

# --- Data Import Functions (Updated to use R2) ---

def import_meta():
    print("Importing meta data...")
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Download meta.csv from R2
        meta_csv_content = download_file_from_r2('meta.csv')
        df = pd.read_csv(io.StringIO(meta_csv_content.decode('utf-8')))

        # Assuming 'meta_data' is your table name (from previous schema setup)
        # Your previous import_meta used "LabTestsOverview", I'm sticking to the one I gave.
        # Please ensure your DB schema matches the one in this script.
        for index, row in df.iterrows():
            cur.execute("""
                INSERT INTO meta_data (id, description, value)
                VALUES (%s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, value = EXCLUDED.value;
            """, (row['id'], row['description'], row['value']))
        conn.commit()
        print("Meta data imported successfully.")

    except Exception as e:
        print(f"Error importing meta data: {e}")
        raise # Re-raise to make sure the deploy fails if import fails
    finally:
        if conn:
            cur.close()
            conn.close()

def import_timeout():
    print("Importing timeout data...")
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Download TimeOut.csv from R2 (Note: using 'TimeOut.csv' as per your upload)
        timeout_csv_content = download_file_from_r2('TimeOut.csv')
        df = pd.read_csv(io.StringIO(timeout_csv_content.decode('utf-8')))

        # Assuming 'timeout_data' is your table name
        for index, row in df.iterrows():
            # Adjust column names and types as per your actual 'TimeOut.csv' and 'timeout_data' table schema
            cur.execute("""
                INSERT INTO timeout_data (
                    lab_id, patient_id, test_name, collection_time, reception_time,
                    analysis_time, validation_time, result_time, tat_minutes, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (patient_id, test_name) DO UPDATE SET
                    collection_time = EXCLUDED.collection_time,
                    reception_time = EXCLUDED.reception_time,
                    analysis_time = EXCLUDED.analysis_time,
                    validation_time = EXCLUDED.validation_time,
                    result_time = EXCLUDED.result_time,
                    tat_minutes = EXCLUDED.tat_minutes,
                    status = EXCLUDED.status;
            """, (
                row['lab_id'], row['patient_id'], row['test_name'],
                row['collection_time'], row['reception_time'],
                row['analysis_time'], row['validation_time'],
                row['result_time'], row['tat_minutes'], row['status']
            ))
        conn.commit()
        print("Timeout data imported successfully.")

    except Exception as e:
        print(f"Error importing timeout data: {e}")
        raise
    finally:
        if conn:
            cur.close()
            conn.close()

def import_patient_data():
    print("Importing patient data...")
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Download data.json from R2
        json_content = download_file_from_r2('data.json')
        data = json.loads(json_content.decode('utf-8'))

        # Assuming 'patients' is your table name for JSON data
        # Adjust table and column names based on your actual JSON structure and DB schema
        for patient in data:
            cur.execute("""
                INSERT INTO patients (
                    patient_id, name, age, gender, address, phone_number, admission_date,
                    diagnosis, attending_doctor, insurance_provider, medical_history
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (patient_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    age = EXCLUDED.age,
                    gender = EXCLUDED.gender,
                    address = EXCLUDED.address,
                    phone_number = EXCLUDED.phone_number,
                    admission_date = EXCLUDED.admission_date,
                    diagnosis = EXCLUDED.diagnosis,
                    attending_doctor = EXCLUDED.attending_doctor,
                    insurance_provider = EXCLUDED.insurance_provider,
                    medical_history = EXCLUDED.medical_history;
            """, (
                patient.get('patient_id'),
                patient.get('name'),
                patient.get('age'),
                patient.get('gender'),
                patient.get('address'),
                patient.get('phone_number'),
                patient.get('admission_date'),
                patient.get('diagnosis'),
                patient.get('attending_doctor'),
                patient.get('insurance_provider'),
                patient.get('medical_history')
            ))
        conn.commit()
        print("Patient data imported successfully.")

    except Exception as e:
        print(f"Error importing patient data: {e}")
        raise
    finally:
        if conn:
            cur.close()
            conn.close()

# --- Main Execution ---
if __name__ == "__main__":
    if not DATABASE_URL:
        print("Error: DATABASE_URL environment variable is not set.")
    elif not all([R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT_URL, R2_BUCKET_NAME]):
        print("Error: R2 environment variables (ACCESS_KEY_ID, SECRET_ACCESS_KEY, ENDPOINT_URL, BUCKET_NAME) are not fully set.")
    else:
        # These functions will now read from R2
        import_meta()
        import_timeout()
        import_patient_data() # Call the new patient data import function