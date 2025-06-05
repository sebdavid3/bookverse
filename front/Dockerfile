# front/Dockerfile

# ----- Etapa de Build -----
FROM node:16-alpine as build-stage

WORKDIR /app

# Copiar package.json y package-lock.json (o yarn.lock)
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código fuente
COPY . .

# Construir la aplicación para producción
# Si tu backend va a estar en un dominio diferente o puerto que el frontend en producción,
# necesitarás configurar REACT_APP_API_URL aquí o manejarlo con Nginx proxy.
# Ejemplo: ENV REACT_APP_API_URL=http://localhost:5001/api
RUN npm run build

# ----- Etapa de Producción -----
FROM nginx:stable-alpine

# Copiar la configuración personalizada de Nginx
# La crearemos en el siguiente paso (front/nginx.conf)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los archivos estáticos construidos desde la etapa de build
COPY --from=build-stage /app/build /usr/share/nginx/html

# Exponer el puerto 80 (estándar para Nginx)
EXPOSE 80

# Comando por defecto para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]