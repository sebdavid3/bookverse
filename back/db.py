import psycopg2
import psycopg2.extras # Para obtener resultados como diccionarios
import os
from dotenv import load_dotenv

load_dotenv() # Carga variables desde .env si existe

DATABASE_URL = os.environ.get('DATABASE_URL') # Para Heroku/similares
if not DATABASE_URL:
    DB_NAME = os.environ.get('DB_NAME', 'bookverse_db') # Nombre por defecto si no está en .env
    DB_USER = os.environ.get('DB_USER', 'postgres')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', 'password')
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_PORT = os.environ.get('DB_PORT', '5432')
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

def get_db_connection():
    """Establece y retorna una conexión a la base de datos."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except psycopg2.OperationalError as e:
        print(f"Error al conectar a la base de datos: {e}")
        # Podrías levantar una excepción personalizada aquí o manejarla de otra forma
        raise

def execute_query(query, params=None, fetchone=False, fetchall=False, commit=False):
    """
    Ejecuta una consulta SQL y opcionalmente retorna resultados o confirma cambios.
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) # Para resultados como diccionarios
        cur.execute(query, params)

        if commit:
            conn.commit()
            if cur.description: # Si la consulta devuelve filas (como un INSERT ... RETURNING)
                if fetchone:
                    return cur.fetchone()
                if fetchall: # Aunque 'commit' y 'fetchall' juntos es raro para un INSERT
                    return cur.fetchall()
            return None # Para INSERT/UPDATE/DELETE sin RETURNING

        if fetchone:
            return cur.fetchone()
        if fetchall:
            return cur.fetchall()

    except (Exception, psycopg2.Error) as error:
        if conn: # Solo hacer rollback si la conexión se estableció
            conn.rollback()
        print(f"Error durante la ejecución de la consulta: {query[:100]}... - {error}")
        # Considera re-lanzar el error o retornar un indicador de error
        raise  # Re-lanzar para que el endpoint maneje el error HTTP
    finally:
        if conn:
            cur.close()
            conn.close()

# --- Funciones de utilidad para la base de datos ---
# (Puedes añadir más aquí a medida que las necesites)

def find_user_by_username(username):
    query = "SELECT * FROM Usuarios WHERE username = %s;"
    return execute_query(query, (username,), fetchone=True)

def find_user_by_id(user_id):
    query = "SELECT user_id, username, email, fecha_registro FROM Usuarios WHERE user_id = %s;"
    return execute_query(query, (user_id,), fetchone=True)