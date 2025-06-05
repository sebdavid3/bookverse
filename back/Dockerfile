# back/Dockerfile

# Usar una imagen base oficial de Python
FROM python:3.8-slim

# Establecer el directorio de trabajo en el contenedor
WORKDIR /app

# Copiar el archivo de requerimientos primero para aprovechar el cache de Docker
COPY requirements.txt .

# Instalar las dependencias
# --no-cache-dir para reducir el tamaño de la imagen
# --trusted-host pypi.python.org --trusted-host pypi.org --trusted-host files.pythonhosted.org si hay problemas de SSL/TLS en alguna red
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del código de la aplicación al directorio de trabajo
COPY . .

# Exponer el puerto en el que Flask se ejecuta (configurado en tu app.py o por defecto 5000/5001)
# Asegúrate que tu app Flask corre en 0.0.0.0 para ser accesible desde fuera del contenedor
EXPOSE 5001

# Comando para ejecutar la aplicación
# Si usas 'python app.py' para producción, considera usar un servidor WSGI como Gunicorn
# CMD ["python", "app.py"]
# Ejemplo con Gunicorn (instálalo añadiendo 'gunicorn' a requirements.txt):
# CMD ["gunicorn", "--bind", "0.0.0.0:5001", "app:app"]
# Asumiendo que tu instancia Flask se llama 'app' en 'app.py'
# Por ahora, usaremos el que tienes, pero Gunicorn es recomendado para producción.
CMD ["python", "app.py"]