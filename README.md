# BookVerse - Club de Lectura Virtual

BookVerse es una aplicación web diseñada para ser un club de lectura virtual y una herramienta de gestión del progreso de lectura. Permite a los usuarios descubrir libros, organizar sus lecturas personales, unirse a clubes de lectura y participar en discusiones.

## Tabla de Contenidos

- [Descripción del Proyecto](#descripción-del-proyecto)
- [Características Principales (MVP)](#características-principales-mvp)
- [Tecnologías Utilizadas](#tecnologías-utilizadas)
- [Prerrequisitos](#prerrequisitos)
- [Instalación y Ejecución](#instalación-y-ejecución)
  - [Backend (Flask)](#backend-flask)
  - [Frontend (React)](#frontend-react)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Endpoints de la API (Resumen)](#endpoints-de-la-api-resumen)
- [Próximos Pasos / Mejoras Futuras](#próximos-pasos--mejoras-futuras)
- [Contribuciones](#contribuciones)
- [Licencia](#licencia)

## Descripción del Proyecto

Muchos lectores disfrutan la lectura como una actividad social, pero enfrentan dificultades para conectar con otros lectores con gustos similares y para llevar un registro organizado de su progreso. BookVerse centraliza la experiencia social y personal de la lectura.

## Características Principales (MVP)

*   **Usuarios:** Registro, inicio de sesión.
*   **Libros:**
    *   Búsqueda de libros (integración con API externa como Open Library).
    *   Importación de libros de la API externa a la base de datos local al interactuar con ellos.
    *   (Admin) Posibilidad de añadir/editar/eliminar libros del catálogo local.
*   **Estanterías Virtuales Personales:**
    *   Añadir libros a "Quiero Leer", "Estoy Leyendo", "Leído".
    *   Marcar progreso y calificación.
    *   Notas privadas por libro.
*   **Clubes de Lectura:**
    *   Ver lista de clubes públicos.
    *   Unirse a un club.
    *   Crear un club (usuarios logueados).
    *   (Admin del Club) Designar el "Libro del Mes/Actual".
*   **Discusiones del Club:**
    *   Ver hilos de discusión (agrupados por libro leído en el club).
    *   Crear nuevos hilos sobre el libro actual.
    *   Ver y publicar comentarios en los hilos.

## Tecnologías Utilizadas

*   **Backend:** Python, Flask, PostgreSQL, Psycopg2, Requests (para API externa).
*   **Frontend:** React, JavaScript, Axios, CSS (o Tailwind CSS si lo usaste).
*   **Autenticación:** Flask-Login (sesiones basadas en cookies).
*   **API de Libros (Externa):** Open Library API (o Google Books API).

## Prerrequisitos

*   Python 3.8+
*   Node.js 16+ y npm (o yarn)
*   PostgreSQL instalado y corriendo.
*   Git

## Instalación y Ejecución

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/TU_USUARIO_GITHUB/NOMBRE_DEL_REPOSITORIO.git
    cd NOMBRE_DEL_REPOSITORIO
    ```

### Backend (Flask)

1.  **Navegar a la carpeta del backend:**
    ```bash
    cd back
    ```
2.  **Crear y activar un entorno virtual:**
    ```bash
    python -m venv venv
    # En Windows:
    .\venv\Scripts\activate
    # En macOS/Linux:
    source venv/bin/activate
    ```
3.  **Instalar dependencias:**
    ```bash
    pip install -r requirements.txt 
    # (Asegúrate de crear este archivo con 'pip freeze > requirements.txt' después de instalar tus paquetes)
    # O instala manualmente: pip install Flask psycopg2-binary python-dotenv Werkzeug Flask-Login Flask-Cors requests
    ```
4.  **Configurar la Base de Datos:**
    *   Asegúrate de tener PostgreSQL corriendo.
    *   Crea una base de datos (ej. `bookverse_db`).
    *   Crea un archivo `.env` en la carpeta `back/` basado en `.env.example` (si creas uno) o con las siguientes variables:
        ```env
        DB_NAME="bookverse_db"
        DB_USER="tu_usuario_postgres"
        DB_PASSWORD="tu_contraseña_postgres"
        DB_HOST="localhost"
        DB_PORT="5432"
        FLASK_SECRET_KEY="una_clave_secreta_muy_larga_y_aleatoria"
        # OPEN_LIBRARY_API_KEY (si la usas, aunque Open Library no siempre la requiere)
        # GOOGLE_BOOKS_API_KEY (si la usas)
        ```
    *   Ejecuta los scripts SQL para crear el esquema y poblar datos de ejemplo:
        ```bash
        psql -U tu_usuario_postgres -d bookverse_db -f schema.sql
        psql -U tu_usuario_postgres -d bookverse_db -f sample_data.sql 
        # (Asegúrate de que estos archivos estén en la carpeta 'back/')
        ```
5.  **Ejecutar el servidor Flask:**
    ```bash
    python app.py
    ```
    El backend debería estar corriendo en `http://localhost:5001` (o el puerto que hayas configurado).

### Frontend (React)

1.  **Navegar a la carpeta del frontend (desde la raíz del proyecto):**
    ```bash
    cd front 
    ```
2.  **Instalar dependencias:**
    ```bash
    npm install
    ```
3.  **(Opcional) Configurar proxy:**
    Si no lo has hecho, añade `"proxy": "http://localhost:5001"` a tu archivo `front/package.json` para redirigir las peticiones API al backend durante el desarrollo.
4.  **Ejecutar la aplicación React:**
    ```bash
    npm start
    ```
    El frontend debería abrirse en `http://localhost:3000`.

## Estructura del Proyecto
bookverse_proyecto_raiz/
├── back/ # Backend (Flask)
│ ├── venv/ # Entorno virtual (ignorado por Git)
│ ├── app.py # Aplicación principal Flask
│ ├── db.py # Lógica de conexión a BD
│ ├── schema.sql # Esquema de la BD
│ ├── sample_data.sql # Datos de ejemplo
│ ├── requirements.txt # Dependencias de Python
│ └── .env # Variables de entorno (ignorado por Git)
├── front/ # Frontend (React)
│ ├── node_modules/ # Dependencias de Node (ignorado por Git)
│ ├── public/
│ ├── src/
│ │ ├── components/
│ │ ├── pages/
│ │ ├── context/
│ │ ├── App.js
│ │ ├── index.js
│ │ └── App.css # (o index.css para estilos globales)
│ ├── package.json
│ └── tailwind.config.js # Si usas Tailwind
├── .gitignore
└── README.md


## Endpoints de la API (Resumen)
*   `POST /api/register` - Registro de usuario
*   `POST /api/login` - Inicio de sesión
*   `POST /api/logout` - Cierre de sesión
*   `GET /api/status` - Verificar estado de sesión
*   `GET /api/books` - Listar/buscar libros del catálogo local
*   `POST /api/books` - (Admin) Añadir libro al catálogo local
*   `PUT /api/books/<id>` - (Admin) Actualizar libro
*   `DELETE /api/books/<id>` - (Admin) Eliminar libro
*   `GET /api/external-books/search` - Buscar libros en API externa
*   `POST /api/books/from-external` - Importar libro de API externa a BD local
*   `GET /api/shelves` - Obtener estanterías del usuario
*   `POST /api/shelves` - Añadir libro a estantería
*   `PUT /api/shelves/<id>` - Actualizar ítem de estantería
*   `DELETE /api/shelves/<id>` - Eliminar ítem de estantería
*   `POST /api/shelves/<id>/notes` - Añadir nota a libro en estantería
*   `PUT /api/notes/<id>` - Actualizar nota
*   `DELETE /api/notes/<id>` - Eliminar nota
*   `GET /api/clubs` - Listar clubes públicos
*   `POST /api/clubs` - Crear club
*   `GET /api/clubs/<id>` - Detalles del club
*   `POST /api/clubs/<id>/join` - Unirse a club
*   `POST /api/clubs/<id>/assign-book` - (Admin Club) Asignar libro del mes
*   `GET /api/clubs/<id>/discussions` - Listar hilos de discusión del club (todos)
*   `POST /api/clubs/<id>/discussions` - Crear hilo de discusión (para libro actual)
*   `GET /api/discussions/<id>/comments` - Listar comentarios de un hilo
*   `POST /api/discussions/<id>/comments` - Publicar comentario

## Próximos Pasos / Mejoras Futuras
*   Refinar UI/UX.
*   Implementar todas las funcionalidades de discusión (editar/eliminar hilos/comentarios).
*   Roles de administrador de sitio más robustos.
*   Paginación para listas largas.
*   Notificaciones.
*   Perfiles de usuario.
*   Pruebas automatizadas.

