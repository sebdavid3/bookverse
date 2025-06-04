from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, UserMixin, login_user, logout_user, current_user, login_required
from flask_cors import CORS
import os
from dotenv import load_dotenv
import requests



import psycopg2 # <--- IMPORTA PSYCOPG2 AQUÍ
from db import execute_query, find_user_by_username, find_user_by_id, get_db_connection # 

from db import execute_query, find_user_by_username, find_user_by_id # Importa funciones de db.py
from flask import Flask, request, jsonify # Asegúrate que jsonify esté importado

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'super-secret-key-for-dev')
CORS(app) # Permite todas las origins por defecto. Ajusta para producción.

# --- Configuración de Flask-Login ---
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login' # Nombre de la función de la vista de login

class User(UserMixin):
    def __init__(self, id, username, email=None): # Añadido email para completitud
        self.id = id
        self.username = username
        self.email = email
    
    # Flask-Login requiere que el id sea string para algunas de sus funciones internas
    def get_id(self):
        return str(self.id)
    
# (Dentro de app.py, o en db.py y luego importar)

GOOGLE_BOOKS_API_KEY = os.environ.get('GOOGLE_BOOKS_API_KEY') # Carga desde .env

# --- Endpoint para buscar libros en Google Books API ---
@app.route('/api/external-books/search', methods=['GET'])
@login_required # Opcional
def search_external_books_open_library():
    query = request.args.get('q') # Término de búsqueda general
    title_query = request.args.get('title')
    author_query = request.args.get('author')

    if not query and not title_query and not author_query:
        return jsonify({"error": "Se requiere un término de búsqueda ('q', 'title', o 'author')"}), 400

    open_library_url = "http://openlibrary.org/search.json"
    params = {}
    if query:
        params['q'] = query
    if title_query:
        params['title'] = title_query
    if author_query:
        params['author'] = author_query
    
    params['limit'] = 20 # Limitar resultados

    try:
        api_response = requests.get(open_library_url, params=params, timeout=10)
        api_response.raise_for_status() 
        data = api_response.json()

        books = []
        if 'docs' in data:
            for doc in data['docs']:
                # Usar el 'key' del trabajo (work) si está disponible, sino la key de la edición.
                # Los trabajos son más generales (ej. "/works/OL45804W").
                # Las ediciones son específicas (ej. "/books/OL7353617M").
                # Para 'external_api_id', preferimos el 'key' porque es único en OpenLibrary.
                external_api_id = doc.get('key') # Este es el ID que guardaremos

                # Tomar el primer ISBN si existe, solo para información adicional, no como ID principal
                isbn = doc.get('isbn', [None])[0] 

                # Construir URL de portada
                cover_url = None
                if doc.get('cover_i'):
                    cover_url = f"https://covers.openlibrary.org/b/id/{doc.get('cover_i')}-M.jpg" # Tamaño Mediano
                elif isbn: # Intentar con ISBN si no hay cover_i
                    cover_url = f"https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg"


                book_data = {
                    "external_api_id": external_api_id, # Usaremos el 'key' de Open Library
                    "titulo": doc.get('title', 'Título Desconocido'),
                    "autor": ", ".join(doc.get('author_name', ['Desconocido'])),
                    "anio_publicacion": str(doc.get('first_publish_year', 'N/A')), # Viene como número
                    "descripcion_api": None, # Open Library search no devuelve descripciones largas. Se necesitaría otra llamada.
                    "url_portada": cover_url,
                }
                if book_data["titulo"] != 'Título Desconocido' and book_data["external_api_id"]:
                    books.append(book_data)
        
        return jsonify(books), 200

    except requests.exceptions.Timeout:
        app.logger.error(f"Timeout al contactar Open Library API para la búsqueda: {params}")
        return jsonify({"error": "Timeout al buscar libros externamente"}), 504
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Error al contactar Open Library API: {e}")
        return jsonify({"error": "Error al buscar libros externamente"}), 503
    except Exception as e:
        app.logger.error(f"Error procesando búsqueda externa de libros (Open Library): {e}")
        return jsonify({"error": "Error interno del servidor"}), 500

# --- Endpoint para "importar" un libro de OPEN LIBRARY a nuestra BD local ---
# La lógica es muy similar, solo cambian los campos que podríamos recibir del frontend.
# El frontend enviará los datos que formateó desde la respuesta de Open Library.
@app.route('/api/books/from-external', methods=['POST'])
@login_required
def import_open_library_book():
    data = request.get_json()

    external_api_id = data.get('external_api_id') # Este será el 'key' de Open Library
    titulo = data.get('titulo')
    autor = data.get('autor')
    url_portada = data.get('url_portada')
    # Open Library search no da descripción fácilmente, así que podría ser null
    descripcion_api = data.get('descripcion_api') 
    anio_publicacion_str = data.get('anio_publicacion')

    if not external_api_id or not titulo:
        return jsonify({"error": "Se requieren external_api_id (key de Open Library) y título"}), 400

    anio_publicacion_int = None
    if anio_publicacion_str and anio_publicacion_str != 'N/A':
        try:
            anio_publicacion_int = int(str(anio_publicacion_str)[:4]) # Tomar solo 4 dígitos
        except ValueError:
            app.logger.warning(f"No se pudo convertir anio_publicacion '{anio_publicacion_str}' a entero.")
            
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("SELECT libro_id, titulo, autor, anio_publicacion, url_portada, descripcion_api FROM Libros WHERE isbn_api_externa = %s;", (external_api_id,))
        existing_book = cur.fetchone()

        if existing_book:
            app.logger.info(f"Libro (Open Library) {external_api_id} ya existe: ID {existing_book['libro_id']}")
            return jsonify({"message": "Libro ya existe en BD local.", "book": existing_book, "is_new": False}), 200

        cur.execute("""
            INSERT INTO Libros (isbn_api_externa, titulo, autor, url_portada, descripcion_api, anio_publicacion)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING libro_id, titulo, autor, anio_publicacion, url_portada, descripcion_api;
        """, (external_api_id, titulo, autor, url_portada, descripcion_api, anio_publicacion_int))
        
        new_book_details = cur.fetchone()
        conn.commit()
        app.logger.info(f"Libro (Open Library) {external_api_id} importado: ID {new_book_details['libro_id']}")
        return jsonify({"message": "Libro importado exitosamente.", "book": new_book_details, "is_new": True}), 201

    except (Exception, psycopg2.Error) as error_db:
        # ... (manejo de error de BD similar al anterior, incluyendo re-intento en caso de violación de unicidad) ...
        if conn: conn.rollback()
        app.logger.error(f"Error de BD al importar libro (Open Library): {error_db}")
        if "violates unique constraint" in str(error_db).lower() and "libros_isbn_api_externa_key" in str(error_db).lower():
             if conn: cur.close(); conn.close()
             conn_retry = None
             try:
                conn_retry = get_db_connection()
                cur_retry = conn_retry.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                cur_retry.execute("SELECT libro_id, titulo FROM Libros WHERE isbn_api_externa = %s;", (external_api_id,))
                existing_book_after_error = cur_retry.fetchone()
                if existing_book_after_error:
                    return jsonify({"message": "Libro ya existe (detectado post-error).", "book": existing_book_after_error, "is_new": False}), 200
             except Exception as e_retry: app.logger.error(f"Error en re-intento: {e_retry}")
             finally:
                 if conn_retry: cur_retry.close(); conn_retry.close()
        return jsonify({"error": "Error interno al importar el libro"}), 500
    finally:
        if conn: 
            if 'cur' in locals() and cur and not cur.closed: cur.close()
            if not conn.closed: conn.close()


@app.route('/api/books', methods=['POST'])
@login_required # Por ahora, solo requiere login. Añadir @admin_required si lo implementas.
def add_new_book():
    data = request.get_json()

    titulo = data.get('titulo')
    autor = data.get('autor')
    isbn_api_externa = data.get('isbn_api_externa') # Puede ser ISBN o ID único de API
    url_portada = data.get('url_portada')
    descripcion_api = data.get('descripcion_api')
    anio_publicacion = data.get('anio_publicacion')

    if not titulo:
        return jsonify({"error": "El título es requerido"}), 400
    
    # Validar anio_publicacion si se proporciona
    if anio_publicacion is not None:
        try:
            anio_publicacion = int(anio_publicacion)
        except ValueError:
            return jsonify({"error": "El año de publicación debe ser un número"}), 400

    try:
        # Verificar si ya existe un libro con ese ISBN/ID de API (si se proporciona)
        if isbn_api_externa:
            check_query = "SELECT libro_id FROM Libros WHERE isbn_api_externa = %s;"
            existing_book = execute_query(check_query, (isbn_api_externa,), fetchone=True)
            if existing_book:
                return jsonify({"error": "Un libro con este ISBN/ID de API ya existe"}), 409
        
        # Opcional: Verificar si ya existe un libro con el mismo título y autor para evitar duplicados menos obvios
        # check_title_author_query = "SELECT libro_id FROM Libros WHERE lower(titulo) = lower(%s) AND lower(autor) = lower(%s);"
        # existing_title_author = execute_query(check_title_author_query, (titulo, autor), fetchone=True)
        # if existing_title_author:
        #     return jsonify({"error": "Un libro con este título y autor ya existe"}), 409


        insert_query = """
            INSERT INTO Libros (titulo, autor, isbn_api_externa, url_portada, descripcion_api, anio_publicacion)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING libro_id, titulo, autor, anio_publicacion;
        """
        new_book = execute_query(
            insert_query,
            (titulo, autor, isbn_api_externa, url_portada, descripcion_api, anio_publicacion),
            commit=True,
            fetchone=True
        )
        return jsonify({"message": "Libro añadido exitosamente", "book": new_book}), 201

    except Exception as e:
        app.logger.error(f"Error al añadir nuevo libro: {e}")
        # Podrías querer verificar errores específicos de la BD aquí, ej. violación de UNIQUE
        if "violates unique constraint" in str(e).lower(): # Detección simple de error de unicidad
             return jsonify({"error": "Error de unicidad, es posible que el libro ya exista (ej. ISBN duplicado)."}), 409
        return jsonify({"error": "Error interno del servidor al añadir el libro"}), 500

def get_club_membership_role(user_id, club_id):
    """Retorna el rol del usuario en el club, o None si no es miembro."""
    if not user_id or not club_id:
        return None
    query = "SELECT rol_en_club FROM MembresiasClub WHERE user_id = %s AND club_id = %s;"
    membership = execute_query(query, (user_id, club_id), fetchone=True)
    return membership['rol_en_club'] if membership else None

def is_user_club_admin(user_id, club_id):
    """Verifica si el usuario es Admin en el club."""
    role = get_club_membership_role(user_id, club_id)
    return role == 'Admin'

def is_user_club_member(user_id, club_id):
    """Verifica si el usuario es miembro (cualquier rol) en el club."""
    return get_club_membership_role(user_id, club_id) is not None

def get_shelf_owner(estanteria_id):
    """Retorna el user_id del dueño de la estanteria_id, o None."""
    query = "SELECT user_id FROM EstanteriasUsuario WHERE estanteria_id = %s;"
    shelf = execute_query(query, (estanteria_id,), fetchone=True)
    return shelf['user_id'] if shelf else None

def get_note_owner(nota_id):
    """Retorna el user_id del dueño de la nota (via estanteria), o None."""
    query = """
        SELECT eu.user_id 
        FROM NotasPrivadasLibro npl
        JOIN EstanteriasUsuario eu ON npl.estanteria_id = eu.estanteria_id
        WHERE npl.nota_id = %s;
    """
    note_owner = execute_query(query, (nota_id,), fetchone=True)
    return note_owner['user_id'] if note_owner else None

def get_thread_creator_and_club(hilo_id):
    """Retorna user_id_creador y club_id del hilo, o None."""
    query = """
        SELECT hdc.user_id_creador, lac.club_id
        FROM HilosDiscusionClub hdc
        JOIN LibrosAsignadosClub lac ON hdc.asignacion_id_libro_club = lac.asignacion_id
        WHERE hdc.hilo_id = %s;
    """
    thread_info = execute_query(query, (hilo_id,), fetchone=True)
    return thread_info if thread_info else None

def get_comment_author_and_club(comentario_id):
    """Retorna user_id_autor y club_id del comentario (via hilo y asignacion), o None."""
    query = """
        SELECT cd.user_id_autor, lac.club_id
        FROM ComentariosDiscusion cd
        JOIN HilosDiscusionClub hdc ON cd.hilo_id = hdc.hilo_id
        JOIN LibrosAsignadosClub lac ON hdc.asignacion_id_libro_club = lac.asignacion_id
        WHERE cd.comentario_id = %s;
    """
    comment_info = execute_query(query, (comentario_id,), fetchone=True)
    return comment_info if comment_info else None

@app.route('/')
def index():
    return jsonify({"message": "¡Bienvenido a la API de BookVerse MVP!"}), 200

@login_manager.user_loader
def load_user(user_id):
    """Carga un usuario dado su ID para Flask-Login."""
    db_user = find_user_by_id(int(user_id)) # user_id viene como string
    if db_user:
        return User(id=db_user['user_id'], username=db_user['username'], email=db_user['email'])
    return None

# --- Rutas de Autenticación ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({"error": "Faltan datos (username, email, password)"}), 400

    if find_user_by_username(username):
        return jsonify({"error": "El nombre de usuario ya existe"}), 409
    
    query_check_email = "SELECT * FROM Usuarios WHERE email = %s;"
    if execute_query(query_check_email, (email,), fetchone=True):
        return jsonify({"error": "El email ya está registrado"}), 409

    hashed_password = generate_password_hash(password)
    
    try:
        query_insert = """
            INSERT INTO Usuarios (username, email, password_hash) 
            VALUES (%s, %s, %s) RETURNING user_id, username, email;
        """
        new_user = execute_query(query_insert, (username, email, hashed_password), commit=True, fetchone=True)
        return jsonify({
            "message": "Usuario registrado exitosamente", 
            "user": {"user_id": new_user['user_id'], "username": new_user['username'], "email": new_user['email']}
            }), 201
    except Exception as e:
        app.logger.error(f"Error en registro: {e}")
        return jsonify({"error": "Error al registrar el usuario"}), 500


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Faltan datos (username, password)"}), 400

    db_user = find_user_by_username(username)

    if db_user and check_password_hash(db_user['password_hash'], password):
        user = User(id=db_user['user_id'], username=db_user['username'], email=db_user['email'])
        login_user(user) # Flask-Login maneja la sesión
        return jsonify({"message": "Login exitoso", "user": {"user_id": user.id, "username": user.username}}), 200
    
    return jsonify({"error": "Credenciales inválidas"}), 401

@app.route('/api/logout', methods=['POST'])
@login_required # Solo usuarios logueados pueden desloguearse
def logout():
    logout_user()
    return jsonify({"message": "Logout exitoso"}), 200

@app.route('/api/status') # Para verificar si el usuario está logueado
@login_required
def status():
    return jsonify({
        "logged_in": True, 
        "user": {"user_id": current_user.id, "username": current_user.username}
        }), 200

# --- Rutas de Libros (MVP Básico) ---
@app.route('/api/books', methods=['GET'])
def get_books():
    """Obtiene todos los libros de la base de datos local."""
    # Para MVP, una búsqueda simple por título. Idealmente, paginación.
    search_term = request.args.get('search', '')
    try:
        if search_term:
            query = "SELECT libro_id, titulo, autor, url_portada, anio_publicacion FROM Libros WHERE lower(titulo) LIKE %s OR lower(autor) LIKE %s ORDER BY titulo;"
            books = execute_query(query, (f"%{search_term.lower()}%", f"%{search_term.lower()}%"), fetchall=True)
        else:
            query = "SELECT libro_id, titulo, autor, url_portada, anio_publicacion FROM Libros ORDER BY titulo LIMIT 20;" # Limitar para MVP
            books = execute_query(query, fetchall=True)
        return jsonify(books), 200
    except Exception as e:
        app.logger.error(f"Error al obtener libros: {e}")
        return jsonify({"error": "Error al obtener libros"}), 500

@app.route('/api/books/<int:book_id>', methods=['GET'])
def get_book_details(book_id):
    """Obtiene detalles de un libro específico."""
    try:
        query = "SELECT * FROM Libros WHERE libro_id = %s;"
        book = execute_query(query, (book_id,), fetchone=True)
        if book:
            return jsonify(book), 200
        return jsonify({"error": "Libro no encontrado"}), 404
    except Exception as e:
        app.logger.error(f"Error al obtener detalles del libro {book_id}: {e}")
        return jsonify({"error": "Error al obtener detalles del libro"}), 500

# --- Rutas de Estanterías (MVP Básico) ---
@app.route('/api/shelves', methods=['GET'])
@login_required
def get_my_shelves():
    """Obtiene los libros en las estanterías del usuario actual, incluyendo sus notas privadas."""
    try:
        # Obtener los ítems de la estantería
        query_shelves = """
            SELECT e.estanteria_id, e.estado_lectura, e.calificacion_usuario, e.progreso_paginas,
                   e.fecha_inicio_lectura, e.fecha_fin_lectura, e.fecha_agregado,
                   l.libro_id, l.titulo, l.autor, l.url_portada, l.anio_publicacion
            FROM EstanteriasUsuario e
            JOIN Libros l ON e.libro_id = l.libro_id
            WHERE e.user_id = %s
            ORDER BY e.fecha_agregado DESC; 
        """
        shelves_items = execute_query(query_shelves, (current_user.id,), fetchall=True)

        if not shelves_items:
            return jsonify([]), 200

        # Para cada ítem de estantería, obtener sus notas
        shelves_with_notes = []
        for item in shelves_items:
            query_notes = """
                SELECT nota_id, contenido_nota, fecha_creacion, fecha_modificacion
                FROM NotasPrivadasLibro
                WHERE estanteria_id = %s
                ORDER BY fecha_creacion DESC;
            """
            notes = execute_query(query_notes, (item['estanteria_id'],), fetchall=True)
            item_with_notes = dict(item) # Crear una copia para modificar
            item_with_notes['notas'] = notes if notes else []
            shelves_with_notes.append(item_with_notes)
            
        return jsonify(shelves_with_notes), 200
    except Exception as e:
        app.logger.error(f"Error al obtener estanterías (con notas) de usuario {current_user.id}: {e}")
        return jsonify({"error": "Error al obtener estanterías"}), 500
    
@app.route('/api/shelves', methods=['POST'])
@login_required
def add_to_shelf():
    """Añade un libro a la estantería del usuario actual."""
    data = request.get_json()
    libro_id = data.get('libro_id')
    estado_lectura = data.get('estado_lectura') # 'QuieroLeer', 'Leyendo', 'Leido'

    if not libro_id or not estado_lectura:
        return jsonify({"error": "Faltan datos (libro_id, estado_lectura)"}), 400
    
    # Validar estado_lectura si es necesario (ENUM lo hace en BD, pero bien validar antes)
    valid_estados = ['QuieroLeer', 'Leyendo', 'Leido']
    if estado_lectura not in valid_estados:
        return jsonify({"error": f"Estado de lectura inválido. Usar: {', '.join(valid_estados)}"}), 400

    try:
        # Verificar que el libro no esté ya en la estantería
        check_query = "SELECT estanteria_id FROM EstanteriasUsuario WHERE user_id = %s AND libro_id = %s;"
        existing_entry = execute_query(check_query, (current_user.id, libro_id), fetchone=True)
        if existing_entry:
            return jsonify({"error": "El libro ya está en tu estantería"}), 409

        query = """
            INSERT INTO EstanteriasUsuario (user_id, libro_id, estado_lectura)
            VALUES (%s, %s, %s) RETURNING estanteria_id, estado_lectura;
        """
        new_shelf_item = execute_query(query, (current_user.id, libro_id, estado_lectura), commit=True, fetchone=True)
        return jsonify({
            "message": "Libro añadido a la estantería",
            "shelf_item": new_shelf_item
            }), 201
    except Exception as e:
        app.logger.error(f"Error al añadir libro {libro_id} a estantería de usuario {current_user.id}: {e}")
        return jsonify({"error": "Error al añadir libro a la estantería"}), 500

# --- Rutas de Clubes de Lectura (MVP Básico) ---
@app.route('/api/clubs', methods=['GET'])
def get_public_clubs():
    """Obtiene una lista de clubes de lectura públicos."""
    try:
        query = """
            SELECT c.club_id, c.nombre_club, c.descripcion_club, u.username AS creador_username, c.fecha_creacion
            FROM ClubesLectura c
            LEFT JOIN Usuarios u ON c.user_id_creador = u.user_id
            WHERE c.es_publico = TRUE
            ORDER BY c.fecha_creacion DESC;
        """
        clubs = execute_query(query, fetchall=True)
        return jsonify(clubs), 200
    except Exception as e:
        app.logger.error(f"Error al obtener clubes públicos: {e}")
        return jsonify({"error": "Error al obtener clubes"}), 500

@app.route('/api/clubs/<int:club_id>', methods=['GET'])
def get_club_details(club_id):
    """Obtiene detalles de un club y el libro actual que están leyendo."""
    try:
        club_query = """
            SELECT c.club_id, c.nombre_club, c.descripcion_club, u.username AS creador_username, c.es_publico, c.fecha_creacion
            FROM ClubesLectura c
            LEFT JOIN Usuarios u ON c.user_id_creador = u.user_id
            WHERE c.club_id = %s;
        """
        club = execute_query(club_query, (club_id,), fetchone=True)
        if not club:
            return jsonify({"error": "Club no encontrado"}), 404

        current_book_query = """
            SELECT l.libro_id, l.titulo, l.autor, lac.fecha_inicio_discusion, lac.fecha_fin_discusion
            FROM LibrosAsignadosClub lac
            JOIN Libros l ON lac.libro_id = l.libro_id
            WHERE lac.club_id = %s AND lac.es_libro_actual = TRUE;
        """
        current_book = execute_query(current_book_query, (club_id,), fetchone=True)
        club['libro_actual'] = current_book if current_book else None
        
        members_query = """
            SELECT u.user_id, u.username, mc.rol_en_club, mc.fecha_union
            FROM MembresiasClub mc
            JOIN Usuarios u ON mc.user_id = u.user_id
            WHERE mc.club_id = %s;
        """
        members = execute_query(members_query, (club_id,), fetchall=True)
        club['miembros'] = members

        return jsonify(club), 200
    except Exception as e:
        app.logger.error(f"Error al obtener detalles del club {club_id}: {e}")
        return jsonify({"error": "Error al obtener detalles del club"}), 500

@app.route('/api/clubs/<int:club_id>/join', methods=['POST'])
@login_required
def join_club(club_id):
    """Permite al usuario actual unirse a un club."""
    try:
        # Verificar que el club existe y es público (o si es privado y tiene invitación, no implementado en MVP)
        club_check_query = "SELECT club_id FROM ClubesLectura WHERE club_id = %s AND es_publico = TRUE;"
        club = execute_query(club_check_query, (club_id,), fetchone=True)
        if not club:
            return jsonify({"error": "Club no encontrado o no es público"}), 404
        
        # Verificar que el usuario no sea ya miembro
        membership_check_query = "SELECT membresia_id FROM MembresiasClub WHERE user_id = %s AND club_id = %s;"
        existing_membership = execute_query(membership_check_query, (current_user.id, club_id), fetchone=True)
        if existing_membership:
            return jsonify({"error": "Ya eres miembro de este club"}), 409

        insert_query = """
            INSERT INTO MembresiasClub (user_id, club_id, rol_en_club)
            VALUES (%s, %s, 'Miembro') RETURNING membresia_id;
        """
        new_membership = execute_query(insert_query, (current_user.id, club_id), commit=True, fetchone=True)
        return jsonify({"message": "Te has unido al club exitosamente", "membresia_id": new_membership['membresia_id']}), 201
    except Exception as e:
        app.logger.error(f"Error al unirse al club {club_id} para usuario {current_user.id}: {e}")
        return jsonify({"error": "Error al unirse al club"}), 500


@app.route('/api/clubs/<int:club_id>/discussions', methods=['GET'])
# No se requiere login para ver hilos públicos de un club (si los clubes son públicos)
# Si quieres que solo miembros vean los hilos, añade @login_required y una verificación de membresía
def get_club_all_discussions(club_id):
    """Obtiene TODOS los hilos de discusión de un club, con información del libro asociado."""
    try:
        # Verificar que el club existe
        club_check = execute_query("SELECT club_id FROM ClubesLectura WHERE club_id = %s", (club_id,), fetchone=True)
        if not club_check:
            return jsonify({"error": "Club no encontrado"}), 404

        # Obtener todos los hilos del club, uniéndolos con LibrosAsignadosClub y Libros
        # para obtener el título del libro y el ID de la asignación.
        hilos_query = """
            SELECT 
                hdc.hilo_id, 
                hdc.titulo_hilo, 
                hdc.contenido_inicial_hilo, 
                hdc.fecha_creacion_hilo, 
                hdc.es_anuncio,
                u.username AS creador_username,
                l.libro_id AS libro_id_asociado,
                l.titulo AS libro_titulo_asociado,
                lac.asignacion_id,  -- ID de la asignación del libro al club
                lac.es_libro_actual -- Para saber si el libro del hilo es el actual
            FROM HilosDiscusionClub hdc
            JOIN Usuarios u ON hdc.user_id_creador = u.user_id
            JOIN LibrosAsignadosClub lac ON hdc.asignacion_id_libro_club = lac.asignacion_id
            JOIN Libros l ON lac.libro_id = l.libro_id
            WHERE lac.club_id = %s
            ORDER BY lac.es_libro_actual DESC, l.titulo ASC, hdc.es_anuncio DESC, hdc.fecha_creacion_hilo DESC;
        """
        # El ORDER BY intenta poner primero los hilos del libro actual,
        # luego agrupa por título de libro, y dentro de eso los anuncios primero, luego por fecha.
        
        hilos = execute_query(hilos_query, (club_id,), fetchall=True)
        
        if not hilos:
            return jsonify([]), 200 # Devolver lista vacía si no hay hilos

        return jsonify(hilos), 200
        
    except Exception as e:
        app.logger.error(f"Error al obtener todas las discusiones del club {club_id}: {e}")
        return jsonify({"error": "Error al obtener las discusiones del club"}), 500
@app.route('/api/discussions/<int:hilo_id>/comments', methods=['GET'])
def get_discussion_comments(hilo_id):
    """Obtiene los comentarios de un hilo de discusión específico."""
    try:
        # Validar que el hilo existe (opcional, pero bueno)
        hilo_check_query = "SELECT hilo_id FROM HilosDiscusionClub WHERE hilo_id = %s;"
        if not execute_query(hilo_check_query, (hilo_id,), fetchone=True):
            return jsonify({"error": "Hilo de discusión no encontrado"}), 404

        comments_query = """
            SELECT c.comentario_id, c.contenido_comentario, c.fecha_envio, c.comentario_padre_id,
                   u.username AS autor_username
            FROM ComentariosDiscusion c
            JOIN Usuarios u ON c.user_id_autor = u.user_id
            WHERE c.hilo_id = %s
            ORDER BY c.fecha_envio ASC;
        """
        # Para un MVP, no implementaremos el anidamiento complejo aquí, solo traeremos todos los comentarios.
        # El frontend tendría que organizar el anidamiento si comentario_padre_id está presente.
        comments = execute_query(comments_query, (hilo_id,), fetchall=True)
        return jsonify(comments), 200
    except Exception as e:
        app.logger.error(f"Error al obtener comentarios del hilo {hilo_id}: {e}")
        return jsonify({"error": "Error al obtener comentarios"}), 500

# --- Endpoint de ejemplo para creación de clubs (requiere estar logueado) ---
@app.route('/api/clubs', methods=['POST'])
@login_required
def create_club():
    data = request.get_json()
    nombre_club = data.get('nombre_club')
    descripcion_club = data.get('descripcion_club')
    es_publico = data.get('es_publico', True) # Por defecto público

    if not nombre_club:
        return jsonify({"error": "El nombre del club es requerido"}), 400

    try:
        # Verificar si ya existe un club con ese nombre
        club_exists_query = "SELECT club_id FROM ClubesLectura WHERE nombre_club = %s;"
        if execute_query(club_exists_query, (nombre_club,), fetchone=True):
            return jsonify({"error": "Ya existe un club con este nombre"}), 409

        insert_club_query = """
            INSERT INTO ClubesLectura (nombre_club, descripcion_club, user_id_creador, es_publico)
            VALUES (%s, %s, %s, %s) RETURNING club_id, nombre_club, user_id_creador;
        """
        new_club = execute_query(insert_club_query, 
                                 (nombre_club, descripcion_club, current_user.id, es_publico),
                                 commit=True, fetchone=True)
        
        # Automáticamente hacer al creador administrador del club
        insert_membership_query = """
            INSERT INTO MembresiasClub (user_id, club_id, rol_en_club)
            VALUES (%s, %s, 'Admin');
        """
        execute_query(insert_membership_query, (current_user.id, new_club['club_id']), commit=True)
        
        return jsonify({"message": "Club creado exitosamente", "club": new_club}), 201
    except Exception as e:
        app.logger.error(f"Error al crear club por usuario {current_user.id}: {e}")
        return jsonify({"error": "Error al crear el club"}), 500


# ... (después de tus endpoints existentes en app.py)

# --- Rutas de Discusiones (Creación y Gestión) ---

@app.route('/api/clubs/<int:club_id>/discussions', methods=['POST'])
@login_required
def create_club_discussion(club_id):
    """Crea un nuevo hilo de discusión para el libro actual de un club."""
    data = request.get_json()
    titulo_hilo = data.get('titulo_hilo')
    contenido_inicial_hilo = data.get('contenido_inicial_hilo')
    es_anuncio = data.get('es_anuncio', False)

    if not titulo_hilo:
        return jsonify({"error": "El título del hilo es requerido"}), 400

    # Verificar que el club existe
    club_check_query = "SELECT club_id FROM ClubesLectura WHERE club_id = %s;"
    if not execute_query(club_check_query, (club_id,), fetchone=True):
        return jsonify({"error": "Club no encontrado"}), 404

    # Verificar que el usuario es miembro para crear hilos normales
    # O admin para crear anuncios
    if not is_user_club_member(current_user.id, club_id):
        return jsonify({"error": "Debes ser miembro del club para crear un hilo"}), 403
    
    if es_anuncio and not is_user_club_admin(current_user.id, club_id):
        return jsonify({"error": "Solo los administradores pueden crear anuncios"}), 403

    # Encontrar la asignación del libro actual para el club
    asignacion_query = """
        SELECT asignacion_id 
        FROM LibrosAsignadosClub 
        WHERE club_id = %s AND es_libro_actual = TRUE;
    """
    asignacion = execute_query(asignacion_query, (club_id,), fetchone=True)

    if not asignacion:
        return jsonify({"error": "Este club no tiene un libro actual asignado para discusión."}), 400
    
    asignacion_id = asignacion['asignacion_id']

    try:
        insert_query = """
            INSERT INTO HilosDiscusionClub 
                (asignacion_id_libro_club, user_id_creador, titulo_hilo, contenido_inicial_hilo, es_anuncio)
            VALUES (%s, %s, %s, %s, %s) RETURNING hilo_id, titulo_hilo, fecha_creacion_hilo;
        """
        new_hilo = execute_query(insert_query, 
                                 (asignacion_id, current_user.id, titulo_hilo, contenido_inicial_hilo, es_anuncio),
                                 commit=True, fetchone=True)
        return jsonify({"message": "Hilo creado exitosamente", "hilo": new_hilo}), 201
    except Exception as e:
        app.logger.error(f"Error al crear hilo en club {club_id} por usuario {current_user.id}: {e}")
        return jsonify({"error": "Error al crear el hilo de discusión"}), 500

@app.route('/api/discussions/<int:hilo_id>/comments', methods=['POST'])
@login_required
def post_comment(hilo_id):
    """Publica un nuevo comentario en un hilo de discusión."""
    data = request.get_json()
    contenido_comentario = data.get('contenido_comentario')
    comentario_padre_id = data.get('comentario_padre_id') # Opcional

    if not contenido_comentario:
        return jsonify({"error": "El contenido del comentario es requerido"}), 400

    # Verificar que el hilo existe y obtener el club_id para verificar membresía
    thread_info = get_thread_creator_and_club(hilo_id)
    if not thread_info:
        return jsonify({"error": "Hilo de discusión no encontrado"}), 404
    
    club_id_of_thread = thread_info['club_id']
    if not is_user_club_member(current_user.id, club_id_of_thread):
        return jsonify({"error": "Debes ser miembro del club para comentar en este hilo"}), 403

    if comentario_padre_id:
        # Verificar que el comentario padre existe y pertenece al mismo hilo
        parent_comment_query = "SELECT comentario_id FROM ComentariosDiscusion WHERE comentario_id = %s AND hilo_id = %s;"
        if not execute_query(parent_comment_query, (comentario_padre_id, hilo_id), fetchone=True):
            return jsonify({"error": "Comentario padre no válido o no pertenece a este hilo"}), 400
    
    try:
        insert_query = """
            INSERT INTO ComentariosDiscusion (hilo_id, user_id_autor, comentario_padre_id, contenido_comentario)
            VALUES (%s, %s, %s, %s) 
            RETURNING comentario_id, contenido_comentario, fecha_envio, comentario_padre_id;
        """
        new_comment = execute_query(insert_query,
                                    (hilo_id, current_user.id, comentario_padre_id, contenido_comentario),
                                    commit=True, fetchone=True)
        return jsonify({"message": "Comentario publicado exitosamente", "comentario": new_comment}), 201
    except Exception as e:
        app.logger.error(f"Error al publicar comentario en hilo {hilo_id} por usuario {current_user.id}: {e}")
        return jsonify({"error": "Error al publicar el comentario"}), 500

# --- Rutas de Estanterías (Actualización, Eliminación, Notas) ---

@app.route('/api/shelves/<int:estanteria_id>', methods=['PUT'])
@login_required
def update_shelf_item(estanteria_id):
    """Actualiza un ítem en la estantería del usuario (estado, progreso, calificación)."""
    owner_id = get_shelf_owner(estanteria_id)
    if not owner_id:
        return jsonify({"error": "Ítem de estantería no encontrado"}), 404
    if owner_id != current_user.id:
        return jsonify({"error": "No tienes permiso para modificar este ítem de estantería"}), 403

    data = request.get_json()
    
    # Campos permitidos para actualizar y sus validaciones básicas
    allowed_updates = {}
    if 'estado_lectura' in data:
        valid_estados = ['QuieroLeer', 'Leyendo', 'Leido']
        if data['estado_lectura'] not in valid_estados:
            return jsonify({"error": f"Estado de lectura inválido. Usar: {', '.join(valid_estados)}"}), 400
        allowed_updates['estado_lectura'] = data['estado_lectura']
    
    if 'calificacion_usuario' in data:
        if data['calificacion_usuario'] is not None: # Permitir NULL para quitar calificación
            try:
                calificacion = int(data['calificacion_usuario'])
                if not (1 <= calificacion <= 5):
                    raise ValueError()
                allowed_updates['calificacion_usuario'] = calificacion
            except (ValueError, TypeError):
                return jsonify({"error": "La calificación debe ser un número entre 1 y 5, o null"}), 400
        else:
            allowed_updates['calificacion_usuario'] = None
            
    if 'progreso_paginas' in data:
        if data['progreso_paginas'] is not None: # Permitir NULL
            try:
                progreso = int(data['progreso_paginas'])
                if progreso < 0: # Podría ser 0 si recién empieza
                     raise ValueError()
                allowed_updates['progreso_paginas'] = progreso
            except (ValueError, TypeError):
                return jsonify({"error": "El progreso en páginas debe ser un número entero no negativo, o null"}), 400
        else:
             allowed_updates['progreso_paginas'] = None

    if 'fecha_inicio_lectura' in data: # Asumir formato YYYY-MM-DD o null
        allowed_updates['fecha_inicio_lectura'] = data['fecha_inicio_lectura']
    if 'fecha_fin_lectura' in data: # Asumir formato YYYY-MM-DD o null
        allowed_updates['fecha_fin_lectura'] = data['fecha_fin_lectura']

    if not allowed_updates:
        return jsonify({"error": "No se proporcionaron campos válidos para actualizar"}), 400

    set_clauses = [f"{key} = %s" for key in allowed_updates.keys()]
    values = list(allowed_updates.values())
    values.append(estanteria_id)

    try:
        update_query = f"""
            UPDATE EstanteriasUsuario
            SET {', '.join(set_clauses)}, fecha_agregado = CURRENT_TIMESTAMP 
            WHERE estanteria_id = %s
            RETURNING *; 
        """ # fecha_agregado se actualiza para reflejar la última modificación. Podría ser una columna `fecha_modificacion` separada.
        updated_item = execute_query(update_query, tuple(values), commit=True, fetchone=True)
        return jsonify({"message": "Ítem de estantería actualizado", "item": updated_item}), 200
    except Exception as e:
        app.logger.error(f"Error al actualizar estantería {estanteria_id} por usuario {current_user.id}: {e}")
        return jsonify({"error": "Error al actualizar el ítem de la estantería"}), 500

@app.route('/api/shelves/<int:estanteria_id>', methods=['DELETE'])
@login_required
def delete_shelf_item(estanteria_id):
    """Elimina un libro de la estantería del usuario."""
    owner_id = get_shelf_owner(estanteria_id)
    if not owner_id:
        return jsonify({"error": "Ítem de estantería no encontrado"}), 404
    if owner_id != current_user.id:
        return jsonify({"error": "No tienes permiso para eliminar este ítem de estantería"}), 403

    try:
        # ON DELETE CASCADE en NotasPrivadasLibro se encargará de las notas asociadas
        delete_query = "DELETE FROM EstanteriasUsuario WHERE estanteria_id = %s;"
        execute_query(delete_query, (estanteria_id,), commit=True)
        return jsonify({"message": "Ítem eliminado de la estantería exitosamente"}), 200
    except Exception as e:
        app.logger.error(f"Error al eliminar estantería {estanteria_id} por usuario {current_user.id}: {e}")
        return jsonify({"error": "Error al eliminar el ítem de la estantería"}), 500

@app.route('/api/shelves/<int:estanteria_id>/notes', methods=['POST'])
@login_required
def add_private_note(estanteria_id):
    """Añade una nota privada a un libro en la estantería del usuario."""
    owner_id = get_shelf_owner(estanteria_id)
    if not owner_id:
        return jsonify({"error": "Ítem de estantería no encontrado"}), 404
    if owner_id != current_user.id:
        return jsonify({"error": "No tienes permiso para añadir notas a este ítem de estantería"}), 403

    data = request.get_json()
    contenido_nota = data.get('contenido_nota')
    if not contenido_nota:
        return jsonify({"error": "El contenido de la nota es requerido"}), 400

    try:
        insert_query = """
            INSERT INTO NotasPrivadasLibro (estanteria_id, contenido_nota)
            VALUES (%s, %s) RETURNING nota_id, contenido_nota, fecha_creacion;
        """
        new_note = execute_query(insert_query, (estanteria_id, contenido_nota), commit=True, fetchone=True)
        return jsonify({"message": "Nota privada añadida exitosamente", "nota": new_note}), 201
    except Exception as e:
        app.logger.error(f"Error al añadir nota a estantería {estanteria_id} por usuario {current_user.id}: {e}")
        return jsonify({"error": "Error al añadir la nota privada"}), 500

@app.route('/api/notes/<int:nota_id>', methods=['PUT'])
@login_required
def update_private_note(nota_id):
    """Actualiza una nota privada existente."""
    owner_id = get_note_owner(nota_id)
    if not owner_id:
        return jsonify({"error": "Nota no encontrada"}), 404
    if owner_id != current_user.id:
        return jsonify({"error": "No tienes permiso para modificar esta nota"}), 403

    data = request.get_json()
    contenido_nota = data.get('contenido_nota')
    if not contenido_nota: # En PUT, se espera el recurso completo, aunque a veces se usa para parcial.
        return jsonify({"error": "El contenido de la nota es requerido para la actualización"}), 400
    
    try:
        update_query = """
            UPDATE NotasPrivadasLibro
            SET contenido_nota = %s, fecha_modificacion = CURRENT_TIMESTAMP
            WHERE nota_id = %s
            RETURNING nota_id, contenido_nota, fecha_modificacion;
        """
        updated_note = execute_query(update_query, (contenido_nota, nota_id), commit=True, fetchone=True)
        return jsonify({"message": "Nota actualizada", "nota": updated_note}), 200
    except Exception as e:
        app.logger.error(f"Error al actualizar nota {nota_id} por usuario {current_user.id}: {e}")
        return jsonify({"error": "Error al actualizar la nota"}), 500


@app.route('/api/notes/<int:nota_id>', methods=['DELETE'])
@login_required
def delete_private_note(nota_id):
    """Elimina una nota privada."""
    owner_id = get_note_owner(nota_id)
    if not owner_id:
        return jsonify({"error": "Nota no encontrada"}), 404
    if owner_id != current_user.id:
        return jsonify({"error": "No tienes permiso para eliminar esta nota"}), 403

    try:
        delete_query = "DELETE FROM NotasPrivadasLibro WHERE nota_id = %s;"
        execute_query(delete_query, (nota_id,), commit=True)
        return jsonify({"message": "Nota eliminada exitosamente"}), 200
    except Exception as e:
        app.logger.error(f"Error al eliminar nota {nota_id} por usuario {current_user.id}: {e}")
        return jsonify({"error": "Error al eliminar la nota"}), 500


# --- Rutas de Gestión de Clubes (Admin) y Membresías ---

@app.route('/api/clubs/<int:club_id>/assign-book', methods=['POST'])
@login_required
def assign_book_to_club(club_id):
    """Asigna o actualiza el libro actual de un club (requiere ser admin)."""
    if not is_user_club_admin(current_user.id, club_id):
        return jsonify({"error": "Solo los administradores del club pueden asignar libros"}), 403

    data = request.get_json()
    libro_id = data.get('libro_id')
    fecha_inicio_discusion = data.get('fecha_inicio_discusion') # Opcional, formato YYYY-MM-DD
    fecha_fin_discusion = data.get('fecha_fin_discusion')     # Opcional, formato YYYY-MM-DD

    if not libro_id:
        return jsonify({"error": "El ID del libro es requerido"}), 400
    
    # Verificar que el libro existe
    book_check_query = "SELECT libro_id FROM Libros WHERE libro_id = %s;"
    if not execute_query(book_check_query, (libro_id,), fetchone=True):
        return jsonify({"error": "Libro no encontrado"}), 404

    conn = None
    try:
        conn = get_db_connection() # Manejar transacción manualmente
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 1. Poner todos los libros actuales de este club como no actuales
        cur.execute("""
            UPDATE LibrosAsignadosClub
            SET es_libro_actual = FALSE
            WHERE club_id = %s AND es_libro_actual = TRUE;
        """, (club_id,))

        # 2. Verificar si ya existe una asignación para este libro y club
        cur.execute("""
            SELECT asignacion_id FROM LibrosAsignadosClub
            WHERE club_id = %s AND libro_id = %s;
        """, (club_id, libro_id))
        existing_assignment = cur.fetchone()

        new_assignment_details = None
        if existing_assignment:
            # Si ya existe, actualizarlo a actual y sus fechas
            cur.execute("""
                UPDATE LibrosAsignadosClub
                SET es_libro_actual = TRUE, 
                    user_id_asignador = %s, 
                    fecha_asignacion = CURRENT_TIMESTAMP,
                    fecha_inicio_discusion = %s,
                    fecha_fin_discusion = %s
                WHERE asignacion_id = %s
                RETURNING asignacion_id, libro_id, es_libro_actual;
            """, (current_user.id, fecha_inicio_discusion, fecha_fin_discusion, existing_assignment['asignacion_id']))
            new_assignment_details = cur.fetchone()
            message = "Libro actual del club actualizado."
        else:
            # Si no existe, crear nueva asignación
            cur.execute("""
                INSERT INTO LibrosAsignadosClub 
                    (club_id, libro_id, user_id_asignador, es_libro_actual, fecha_inicio_discusion, fecha_fin_discusion)
                VALUES (%s, %s, %s, TRUE, %s, %s)
                RETURNING asignacion_id, libro_id, es_libro_actual;
            """, (club_id, libro_id, current_user.id, fecha_inicio_discusion, fecha_fin_discusion))
            new_assignment_details = cur.fetchone()
            message = "Libro asignado como actual al club."
        
        conn.commit()
        return jsonify({"message": message, "asignacion": new_assignment_details}), 200

    except (Exception, psycopg2.Error) as error:
        if conn:
            conn.rollback()
        app.logger.error(f"Error al asignar libro al club {club_id}: {error}")
        return jsonify({"error": "Error al asignar el libro al club"}), 500
    finally:
        if conn:
            cur.close()
            conn.close()

@app.route('/api/clubs/<int:club_id>', methods=['PUT'])
@login_required
def update_club_details(club_id):
    """Actualiza los detalles de un club (requiere ser admin o creador)."""
    club_info_query = "SELECT user_id_creador FROM ClubesLectura WHERE club_id = %s;"
    club_db = execute_query(club_info_query, (club_id,), fetchone=True)

    if not club_db:
        return jsonify({"error": "Club no encontrado"}), 404

    is_admin = is_user_club_admin(current_user.id, club_id)
    is_creator = (club_db['user_id_creador'] == current_user.id)

    if not (is_admin or is_creator):
        return jsonify({"error": "No tienes permiso para modificar este club"}), 403

    data = request.get_json()
    allowed_updates = {}
    if 'nombre_club' in data:
        if not data['nombre_club'].strip():
            return jsonify({"error": "El nombre del club no puede estar vacío"}), 400
        # Chequear unicidad del nombre si cambia
        if data['nombre_club'] != execute_query("SELECT nombre_club FROM ClubesLectura WHERE club_id = %s", (club_id,), fetchone=True)['nombre_club']:
            name_check = "SELECT club_id FROM ClubesLectura WHERE nombre_club = %s AND club_id != %s;"
            if execute_query(name_check, (data['nombre_club'], club_id), fetchone=True):
                return jsonify({"error": "Ya existe otro club con este nombre"}), 409
        allowed_updates['nombre_club'] = data['nombre_club']
    
    if 'descripcion_club' in data:
        allowed_updates['descripcion_club'] = data['descripcion_club']
    
    if 'es_publico' in data:
        if not isinstance(data['es_publico'], bool):
            return jsonify({"error": "'es_publico' debe ser un valor booleano (true/false)"}), 400
        allowed_updates['es_publico'] = data['es_publico']
    
    if not allowed_updates:
        return jsonify({"error": "No se proporcionaron campos válidos para actualizar"}), 400

    set_clauses = [f"{key} = %s" for key in allowed_updates.keys()]
    values = list(allowed_updates.values())
    values.append(club_id)

    try:
        update_query = f"""
            UPDATE ClubesLectura
            SET {', '.join(set_clauses)}
            WHERE club_id = %s
            RETURNING club_id, nombre_club, descripcion_club, es_publico;
        """
        updated_club = execute_query(update_query, tuple(values), commit=True, fetchone=True)
        return jsonify({"message": "Club actualizado exitosamente", "club": updated_club}), 200
    except Exception as e:
        app.logger.error(f"Error al actualizar club {club_id}: {e}")
        return jsonify({"error": "Error al actualizar el club"}), 500

@app.route('/api/clubs/<int:club_id>/leave', methods=['POST']) # POST es más semántico para una acción que cambia estado
@login_required
def leave_club(club_id):
    """Permite al usuario actual abandonar un club."""
    if not is_user_club_member(current_user.id, club_id):
        return jsonify({"error": "No eres miembro de este club"}), 404 # O 403 si se considera un intento no autorizado

    # Consideración: Si el último admin abandona. Para MVP, se permite.
    # Si el creador original (user_id_creador en ClubesLectura) quiere "abandonar",
    # su rol en MembresiasClub se elimina, pero sigue siendo el user_id_creador en la tabla ClubesLectura.
    # La lógica de "creador" vs "admin" puede ser diferente. Aquí, 'leave' elimina la membresía.
    
    try:
        delete_query = "DELETE FROM MembresiasClub WHERE user_id = %s AND club_id = %s;"
        execute_query(delete_query, (current_user.id, club_id), commit=True)
        return jsonify({"message": "Has abandonado el club exitosamente"}), 200
    except Exception as e:
        app.logger.error(f"Error al abandonar club {club_id} por usuario {current_user.id}: {e}")
        return jsonify({"error": "Error al abandonar el club"}), 500


# Endpoint para eliminar un club (opcional, pero solicitado en la idea)
@app.route('/api/clubs/<int:club_id>', methods=['DELETE'])
@login_required
def delete_club(club_id):
    """Elimina un club (requiere ser creador o admin principal - simplificado a creador por ahora)."""
    # Para una lógica más robusta, se podría requerir ser el único admin o el creador.
    # Aquí simplificaremos: solo el user_id_creador de la tabla ClubesLectura puede eliminarlo.
    club_info_query = "SELECT user_id_creador FROM ClubesLectura WHERE club_id = %s;"
    club_db = execute_query(club_info_query, (club_id,), fetchone=True)

    if not club_db:
        return jsonify({"error": "Club no encontrado"}), 404
    
    if club_db['user_id_creador'] != current_user.id:
        # O si quieres que cualquier admin pueda: if not is_user_club_admin(current_user.id, club_id):
        return jsonify({"error": "Solo el creador original puede eliminar este club"}), 403

    try:
        # Las reglas ON DELETE CASCADE en el DDL se encargarán de limpiar:
        # MembresiasClub, LibrosAsignadosClub (y por ende HilosDiscusionClub y ComentariosDiscusion)
        delete_query = "DELETE FROM ClubesLectura WHERE club_id = %s;"
        execute_query(delete_query, (club_id,), commit=True)
        return jsonify({"message": f"Club {club_id} y todos sus datos asociados han sido eliminados."}), 200
    except Exception as e:
        app.logger.error(f"Error al eliminar club {club_id} por usuario {current_user.id}: {e}")
        # Podría haber restricciones si, por ejemplo, un libro está referenciado y tiene ON DELETE RESTRICT
        # pero según el DDL, LibrosAsignadosClub tiene ON DELETE CASCADE desde ClubesLectura.
        return jsonify({"error": "Error al eliminar el club"}), 500
    
    
    
@app.route('/api/books/<int:libro_id>', methods=['PUT'])
@login_required # Debería ser @site_admin_required
def update_book(libro_id):
    # if not getattr(current_user, 'is_site_admin', False): # Ejemplo de check de rol
    #     return jsonify({"error": "Acceso no autorizado"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No se proporcionaron datos para actualizar"}), 400

    # Verificar que el libro exista
    book_exists = execute_query("SELECT libro_id FROM Libros WHERE libro_id = %s", (libro_id,), fetchone=True)
    if not book_exists:
        return jsonify({"error": "Libro no encontrado"}), 404

    # Construir la parte SET de la consulta dinámicamente
    set_clauses = []
    values = []
    allowed_fields = ['titulo', 'autor', 'isbn_api_externa', 'url_portada', 'descripcion_api', 'anio_publicacion']

    for field in allowed_fields:
        if field in data:
            set_clauses.append(f"{field} = %s")
            if field == 'anio_publicacion' and data[field] is not None:
                try:
                    values.append(int(data[field]))
                except ValueError:
                    return jsonify({"error": f"Valor inválido para {field}"}), 400
            else:
                values.append(data[field])
    
    if not set_clauses:
        return jsonify({"error": "No se proporcionaron campos válidos para actualizar"}), 400

    values.append(libro_id) # Para la cláusula WHERE

    try:
        # Opcional: Si se actualiza isbn_api_externa, verificar unicidad si no es el mismo libro
        if 'isbn_api_externa' in data and data['isbn_api_externa']:
            check_isbn_query = "SELECT libro_id FROM Libros WHERE isbn_api_externa = %s AND libro_id != %s;"
            conflicting_book = execute_query(check_isbn_query, (data['isbn_api_externa'], libro_id), fetchone=True)
            if conflicting_book:
                return jsonify({"error": "Otro libro ya tiene ese ISBN/ID API externo."}), 409

        update_query = f"UPDATE Libros SET {', '.join(set_clauses)} WHERE libro_id = %s RETURNING *;"
        updated_book = execute_query(update_query, tuple(values), commit=True, fetchone=True)
        
        if updated_book:
            return jsonify({"message": "Libro actualizado exitosamente", "book": updated_book}), 200
        else:
            # Esto no debería ocurrir si la comprobación de libro_existe pasó y la actualización fue válida
            return jsonify({"error": "No se pudo actualizar el libro"}), 500 
            
    except (Exception, psycopg2.Error) as e:
        app.logger.error(f"Error al actualizar libro {libro_id}: {e}")
        if "violates unique constraint" in str(e).lower():
             return jsonify({"error": "Error de unicidad (ej. ISBN/ID API externo duplicado)."}), 409
        return jsonify({"error": "Error interno del servidor al actualizar el libro"}), 500


@app.route('/api/books/<int:libro_id>', methods=['DELETE'])
@login_required # Debería ser @site_admin_required
def delete_book(libro_id):
    # if not getattr(current_user, 'is_site_admin', False):
    #     return jsonify({"error": "Acceso no autorizado"}), 403

    # Verificar que el libro exista antes de intentar borrarlo
    book_to_delete = execute_query("SELECT libro_id FROM Libros WHERE libro_id = %s", (libro_id,), fetchone=True)
    if not book_to_delete:
        return jsonify({"error": "Libro no encontrado"}), 404

    try:
        # Considerar las relaciones: ON DELETE RESTRICT en EstanteriasUsuario y LibrosAsignadosClub
        # Si un libro está en una estantería o asignado a un club, NO se podrá borrar
        # a menos que cambies esas restricciones a ON DELETE CASCADE o SET NULL.
        # El error de la BD informará sobre esto.
        
        execute_query("DELETE FROM Libros WHERE libro_id = %s", (libro_id,), commit=True)
        # execute_query devuelve None para DELETE sin RETURNING, así que no hay `deleted_book`
        
        return jsonify({"message": f"Libro con ID {libro_id} eliminado exitosamente"}), 200
        
    except (Exception, psycopg2.Error) as e:
        app.logger.error(f"Error al eliminar libro {libro_id}: {e}")
        if "violates foreign key constraint" in str(e).lower():
            return jsonify({"error": "No se puede eliminar el libro porque está referenciado en estanterías o clubes de lectura."}), 409 # Conflict
        return jsonify({"error": "Error interno del servidor al eliminar el libro"}), 500

CORS(app, supports_credentials=True, origins=["http://localhost:3000"])

if __name__ == '__main__':
    # Configura el logging para ver errores en la consola de Flask
    import logging
    logging.basicConfig(level=logging.INFO)
    app.run(debug=True, port=5001) # Puerto diferente por si tienes otra app en 5000
    
